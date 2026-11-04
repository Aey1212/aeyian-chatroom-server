// SPDX-License-Identifier: AGPL-3.0-or-later

import {getEmojiURL as getUnicodeEmojiURL} from '@app/features/expressions/utils/EmojiUtils';
import styles from '@app/features/soundboard/components/Soundboard.module.css';
import {getEmojiURL} from '@app/features/user/utils/AvatarUtils';
import {SpeakerHighIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

export const SoundboardSoundEmoji = observer(function SoundboardSoundEmoji({
	emojiId,
	emojiName,
}: {
	emojiId: string | null;
	emojiName: string | null;
}) {
	if (emojiId) {
		return (
			<img
				className={styles.emoji}
				src={getEmojiURL({id: emojiId})}
				alt=""
				draggable={false}
				data-flx="soundboard.sound-emoji.custom"
			/>
		);
	}
	if (emojiName) {
		const url = getUnicodeEmojiURL(emojiName);
		return url ? (
			<img
				className={styles.emoji}
				src={url}
				alt={emojiName}
				draggable={false}
				data-flx="soundboard.sound-emoji.unicode"
			/>
		) : (
			<span className={styles.emojiText} data-flx="soundboard.sound-emoji.text">
				{emojiName}
			</span>
		);
	}
	return <SpeakerHighIcon weight="fill" className={styles.emojiFallback} data-flx="soundboard.sound-emoji.fallback" />;
});
