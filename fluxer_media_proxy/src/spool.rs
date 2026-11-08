// SPDX-License-Identifier: AGPL-3.0-or-later

use axum::body::Body;
use http_body_util::BodyExt;
use std::{io::SeekFrom, path::Path};
use thiserror::Error;
use tokio::{
    fs::File,
    io::{AsyncSeekExt, AsyncWriteExt, BufWriter},
};

use crate::upload_relay::SpoolReservation;

#[derive(Debug, Error)]
pub enum SpoolError {
    #[error("payload exceeded declared length")]
    PayloadTooLarge,
    #[error("payload shorter than declared length")]
    PayloadShortRead,
    #[error("disk spool budget exhausted")]
    BudgetExhausted,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("body read error: {0}")]
    Body(axum::Error),
}

// Upstream Fluxer f9b469149 (#3878): the spool budget stays reserved for as long as the file is on
// disk. into_parts hands the reservation to the caller, who keeps it until the upload to storage is
// done; before, it was released here, so the spool ceiling did not hold while files were uploading.
#[derive(Debug)]
pub struct SpooledBody {
    file: File,
    length: u64,
    reservation: SpoolReservation,
}

impl SpooledBody {
    pub fn into_parts(self) -> (File, u64, SpoolReservation) {
        (self.file, self.length, self.reservation)
    }

    pub fn len(&self) -> u64 {
        self.length
    }

    pub fn is_empty(&self) -> bool {
        self.length == 0
    }
}

pub async fn spool_to_temp(
    body: Body,
    declared_length: Option<u64>,
    max_body_bytes: u64,
    dir: &Path,
    write_buffer_bytes: usize,
    spool_total_ceiling: u64,
) -> Result<SpooledBody, SpoolError> {
    if let Some(declared_length) = declared_length
        && declared_length > max_body_bytes
    {
        return Err(SpoolError::PayloadTooLarge);
    }
    // A body of unknown length reserves what it writes as it arrives, instead of its whole maximum.
    let mut reservation =
        SpoolReservation::try_new(declared_length.unwrap_or(0), spool_total_ceiling)
            .ok_or(SpoolError::BudgetExhausted)?;
    let (file, length) = spool_body_inner(
        body,
        declared_length,
        max_body_bytes,
        spool_total_ceiling,
        &mut reservation,
        dir,
        write_buffer_bytes,
    )
    .await?;
    Ok(SpooledBody {
        file,
        length,
        reservation,
    })
}

async fn spool_body_inner(
    mut body: Body,
    declared_length: Option<u64>,
    max_body_bytes: u64,
    spool_total_ceiling: u64,
    reservation: &mut SpoolReservation,
    dir: &Path,
    write_buffer_bytes: usize,
) -> Result<(File, u64), SpoolError> {
    let std_file = tempfile::tempfile_in(dir)?;
    let mut writer = BufWriter::with_capacity(write_buffer_bytes, File::from_std(std_file));
    let mut written: u64 = 0;
    while let Some(frame_result) = body.frame().await {
        let frame = frame_result.map_err(SpoolError::Body)?;
        let Ok(chunk) = frame.into_data() else {
            continue;
        };
        if chunk.is_empty() {
            continue;
        }
        let next = written.saturating_add(chunk.len() as u64);
        if next > max_body_bytes || declared_length.is_some_and(|declared| next > declared) {
            return Err(SpoolError::PayloadTooLarge);
        }
        if declared_length.is_none()
            && !reservation.try_grow(chunk.len() as u64, spool_total_ceiling)
        {
            return Err(SpoolError::BudgetExhausted);
        }
        writer.write_all(&chunk).await?;
        written = next;
    }
    if declared_length.is_some_and(|declared| written != declared) {
        return Err(SpoolError::PayloadShortRead);
    }
    writer.flush().await?;
    let mut file = writer.into_inner();
    file.seek(SeekFrom::Start(0)).await?;
    Ok((file, written))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;
    use http_body::Frame;
    use http_body_util::StreamBody;
    use tokio::io::AsyncReadExt;

    const SPOOL_RESERVATION_BYTES: u64 = 600 * 1024 * 1024;
    const SPOOL_CEILING_BYTES: u64 = 1000 * 1024 * 1024;

    async fn budgeted_spool(
        dir: &Path,
        declared_length: Option<u64>,
    ) -> Result<SpooledBody, SpoolError> {
        spool_to_temp(
            Body::from(vec![0u8; 16]),
            declared_length,
            SPOOL_RESERVATION_BYTES,
            dir,
            64 * 1024,
            SPOOL_CEILING_BYTES,
        )
        .await
    }

    fn body_with_trailers(chunks: &[&[u8]]) -> Body {
        let mut frames: Vec<Result<Frame<Bytes>, std::io::Error>> = chunks
            .iter()
            .map(|chunk| Ok(Frame::data(Bytes::copy_from_slice(chunk))))
            .collect();
        let mut trailers = http::HeaderMap::new();
        trailers.insert("x-checksum", http::HeaderValue::from_static("deadbeef"));
        frames.push(Ok(Frame::trailers(trailers)));
        Body::new(StreamBody::new(futures_util::stream::iter(frames)))
    }

    #[tokio::test]
    async fn spools_full_body_to_disk() {
        let payload = vec![0xABu8; 4096];
        let body = Body::from(payload.clone());
        let dir = tempfile::tempdir().unwrap();
        let spooled = spool_to_temp(
            body,
            Some(payload.len() as u64),
            1 << 20,
            dir.path(),
            1024,
            1 << 30,
        )
        .await
        .unwrap();
        let (mut file, len, _reservation) = spooled.into_parts();
        assert_eq!(len, payload.len() as u64);
        let mut read_back = Vec::with_capacity(payload.len());
        file.read_to_end(&mut read_back).await.unwrap();
        assert_eq!(read_back, payload);
    }

    #[tokio::test]
    async fn rejects_payload_longer_than_declared() {
        let body = Body::from(vec![0u8; 2048]);
        let dir = tempfile::tempdir().unwrap();
        let err = spool_to_temp(body, Some(1024), 1 << 20, dir.path(), 1024, 1 << 30)
            .await
            .unwrap_err();
        assert!(matches!(err, SpoolError::PayloadTooLarge));
    }

    #[tokio::test]
    async fn rejects_payload_shorter_than_declared() {
        let body = Body::from(vec![0u8; 1024]);
        let dir = tempfile::tempdir().unwrap();
        let err = spool_to_temp(body, Some(2048), 1 << 20, dir.path(), 1024, 1 << 30)
            .await
            .unwrap_err();
        assert!(matches!(err, SpoolError::PayloadShortRead));
    }

    #[tokio::test]
    async fn rejects_when_budget_exhausted() {
        let body = Body::from(vec![0u8; 1024]);
        let dir = tempfile::tempdir().unwrap();
        let err = spool_to_temp(body, Some(1024), 1 << 20, dir.path(), 1024, 512)
            .await
            .unwrap_err();
        assert!(matches!(err, SpoolError::BudgetExhausted));
    }

    #[tokio::test]
    async fn spools_unknown_length_body_up_to_limit() {
        let payload = vec![0xCDu8; 2048];
        let body = Body::from(payload.clone());
        let dir = tempfile::tempdir().unwrap();
        let spooled = spool_to_temp(body, None, 4096, dir.path(), 1024, 1 << 30)
            .await
            .unwrap();
        let (mut file, len, _reservation) = spooled.into_parts();
        assert_eq!(len, payload.len() as u64);
        let mut read_back = Vec::with_capacity(payload.len());
        file.read_to_end(&mut read_back).await.unwrap();
        assert_eq!(read_back, payload);
    }

    #[tokio::test]
    async fn rejects_unknown_length_body_over_limit() {
        let body = Body::from(vec![0u8; 2048]);
        let dir = tempfile::tempdir().unwrap();
        let err = spool_to_temp(body, None, 1024, dir.path(), 1024, 1 << 30)
            .await
            .unwrap_err();
        assert!(matches!(err, SpoolError::PayloadTooLarge));
    }

    // The spool budget is one process-wide counter shared with the other tests running in parallel.
    // Like SPOOL_RESERVATION_BYTES above, this holds 600 MiB of a 1000 MiB ceiling: enough to be
    // refused a second time, while the other tests (a few KiB under a 1 GiB ceiling) still fit.
    #[test]
    fn reservations_share_one_total_budget_until_dropped() {
        let held = SpoolReservation::try_new(SPOOL_RESERVATION_BYTES, SPOOL_CEILING_BYTES)
            .expect("first reservation");
        assert!(SpoolReservation::try_new(SPOOL_RESERVATION_BYTES, SPOOL_CEILING_BYTES).is_none());
        let mut grown =
            SpoolReservation::try_new(0, SPOOL_CEILING_BYTES).expect("empty reservation");
        assert!(!grown.try_grow(SPOOL_RESERVATION_BYTES, SPOOL_CEILING_BYTES));
        assert!(grown.try_grow(1024, SPOOL_CEILING_BYTES));
        assert_eq!(1024, grown.bytes());
        drop(grown);
        drop(held);
        assert!(SpoolReservation::try_new(SPOOL_RESERVATION_BYTES, SPOOL_CEILING_BYTES).is_some());
    }

    #[test]
    fn a_refused_reservation_leaves_the_budget_untouched() {
        let before =
            SpoolReservation::try_new(1024, SPOOL_CEILING_BYTES).expect("small reservation");
        assert!(SpoolReservation::try_new(1024, 512).is_none());
        drop(before);
        // A wrapped counter would refuse even this small reservation.
        assert!(SpoolReservation::try_new(1024, SPOOL_CEILING_BYTES).is_some());
    }

    #[tokio::test]
    async fn an_unknown_length_spool_reserves_what_it_wrote_and_hands_it_on() {
        let dir = tempfile::tempdir().unwrap();
        let spooled = budgeted_spool(dir.path(), None).await.unwrap();
        let (_file, len, reservation) = spooled.into_parts();
        assert_eq!(16, len);
        assert_eq!(16, reservation.bytes());
    }

    #[tokio::test]
    async fn a_declared_length_spool_reserves_its_declared_length() {
        let dir = tempfile::tempdir().unwrap();
        let spooled = budgeted_spool(dir.path(), Some(16)).await.unwrap();
        let (_file, _len, reservation) = spooled.into_parts();
        assert_eq!(16, reservation.bytes());
    }

    #[tokio::test]
    async fn an_unknown_length_spool_stops_when_the_budget_runs_out() {
        let dir = tempfile::tempdir().unwrap();
        let err = spool_to_temp(
            Body::from(vec![0u8; 16]),
            None,
            1 << 20,
            dir.path(),
            1024,
            8,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, SpoolError::BudgetExhausted));
    }

    #[tokio::test]
    async fn a_trailer_frame_carries_no_payload_towards_the_declared_length() {
        let dir = tempfile::tempdir().unwrap();
        let short = spool_to_temp(
            body_with_trailers(&[b"hello".as_slice()]),
            Some(8),
            1 << 20,
            dir.path(),
            1024,
            1 << 30,
        )
        .await
        .unwrap_err();
        assert!(matches!(short, SpoolError::PayloadShortRead));

        let exact = spool_to_temp(
            body_with_trailers(&[b"hel".as_slice(), b"".as_slice(), b"lo".as_slice()]),
            Some(5),
            1 << 20,
            dir.path(),
            1024,
            1 << 30,
        )
        .await
        .unwrap();
        let (mut file, len, _reservation) = exact.into_parts();
        assert_eq!(len, 5);
        let mut read_back = Vec::new();
        file.read_to_end(&mut read_back).await.unwrap();
        assert_eq!(read_back, b"hello".as_slice());
    }

    #[tokio::test]
    async fn no_spool_file_is_ever_left_behind_in_the_spool_directory() {
        let dir = tempfile::tempdir().unwrap();
        for (declared, max_body_bytes, payload) in [
            (Some(1024u64), 1 << 20, 2048usize),
            (Some(2048), 1 << 20, 1024),
            (None, 1024, 2048),
        ] {
            assert!(
                spool_to_temp(
                    Body::from(vec![0u8; payload]),
                    declared,
                    max_body_bytes,
                    dir.path(),
                    1024,
                    1 << 30,
                )
                .await
                .is_err()
            );
            assert!(spool_dir_is_empty(dir.path()).await);
        }
        let spooled = spool_to_temp(
            Body::from(vec![0u8; 1024]),
            Some(1024),
            1 << 20,
            dir.path(),
            1024,
            1 << 30,
        )
        .await
        .unwrap();
        assert!(spool_dir_is_empty(dir.path()).await);
        drop(spooled);
        assert!(spool_dir_is_empty(dir.path()).await);
    }

    async fn spool_dir_is_empty(dir: &Path) -> bool {
        let mut entries = tokio::fs::read_dir(dir).await.unwrap();
        entries.next_entry().await.unwrap().is_none()
    }
}
