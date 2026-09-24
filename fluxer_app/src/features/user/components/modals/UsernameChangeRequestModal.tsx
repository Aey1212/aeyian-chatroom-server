// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {EXAMPLE_USERNAME} from '@app/features/app/config/I18nDisplayConstants';
import {useFormSubmit} from '@app/features/app/hooks/useFormSubmit';
import {USERNAME_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Form} from '@app/features/ui/components/form/Form';
import {Input} from '@app/features/ui/components/form/FormInput';
import {UsernameValidationRules} from '@app/features/ui/components/form/UsernameValidationRules';
import {WarningAlert} from '@app/features/ui/warning_alert/WarningAlert';
import * as UserCommands from '@app/features/user/commands/UserCommands';
import styles from '@app/features/user/components/modals/UsernameChangeRequestModal.module.css';
import type {User} from '@app/features/user/models/User';
import {getFormattedDateTime} from '@app/features/user/utils/DateFormatting';
import type {UsernameChangeRequestResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Controller, useForm} from 'react-hook-form';

const RENAME_REQUEST_SENT_DESCRIPTOR = msg({
	message: 'Rename request sent',
	comment: 'Toast after a user asks for a new username. The admin still has to approve it.',
});
const RENAME_REQUEST_CANCELLED_DESCRIPTOR = msg({
	message: 'Rename request cancelled',
	comment: 'Toast after a user cancels their pending rename request.',
});
const REQUEST_A_NEW_USERNAME_FORM_DESCRIPTOR = msg({
	message: 'Request a new username form',
	comment: 'Accessible label of the rename request form.',
});
const REQUEST_A_NEW_USERNAME_DESCRIPTOR = msg({
	message: 'Request a new username',
	comment: 'Title of the rename request modal.',
});

type UsernameChangeRequest = NonNullable<UsernameChangeRequestResponse['request']>;

interface FormInputs {
	username: string;
}

interface UsernameChangeRequestModalProps {
	user: User;
}

export const UsernameChangeRequestModal = observer(({user}: UsernameChangeRequestModalProps) => {
	const {i18n} = useLingui();
	const usernameRef = useRef<HTMLInputElement>(null);
	const [latestRequest, setLatestRequest] = useState<UsernameChangeRequest | null>(null);
	const [isCancelling, setIsCancelling] = useState(false);
	const form = useForm<FormInputs>({defaultValues: {username: ''}});
	useEffect(() => {
		let active = true;
		UserCommands.getUsernameChangeRequest()
			.then((request) => {
				if (active) setLatestRequest(request);
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, []);
	const onSubmit = useCallback(
		async (data: FormInputs) => {
			await UserCommands.submitUsernameChangeRequest(data.username.trim());
			ModalCommands.pop();
			ToastCommands.createToast({type: 'success', children: i18n._(RENAME_REQUEST_SENT_DESCRIPTOR)});
		},
		[i18n],
	);
	const {handleSubmit, isSubmitting} = useFormSubmit({form, onSubmit, defaultErrorField: 'username'});
	const handleCancelRequest = useCallback(async () => {
		setIsCancelling(true);
		try {
			await UserCommands.cancelUsernameChangeRequest();
			setLatestRequest((request) => (request ? {...request, status: 'cancelled'} : request));
			ToastCommands.createToast({type: 'success', children: i18n._(RENAME_REQUEST_CANCELLED_DESCRIPTOR)});
		} finally {
			setIsCancelling(false);
		}
	}, [i18n]);
	const pendingRequest = latestRequest?.status === 'pending' ? latestRequest : null;
	const rejectedRequest = latestRequest?.status === 'rejected' ? latestRequest : null;
	return (
		<Modal.Root
			size="small"
			centered
			initialFocusRef={usernameRef}
			data-flx="user.username-change-request-modal.modal-root"
		>
			<Form
				form={form}
				onSubmit={handleSubmit}
				aria-label={i18n._(REQUEST_A_NEW_USERNAME_FORM_DESCRIPTOR)}
				data-flx="user.username-change-request-modal.form.submit"
			>
				<Modal.Header
					title={i18n._(REQUEST_A_NEW_USERNAME_DESCRIPTOR)}
					data-flx="user.username-change-request-modal.modal-header"
				/>
				<Modal.Content data-flx="user.username-change-request-modal.modal-content">
					<Modal.ContentLayout data-flx="user.username-change-request-modal.modal-content-layout">
						<Modal.Description data-flx="user.username-change-request-modal.modal-description">
							<Trans>
								Your username is <strong data-flx="user.username-change-request-modal.strong">{user.username}</strong>.
								A new username is a request: the name is held for you until the admin approves or rejects it. Usernames
								are case-insensitive.
							</Trans>
						</Modal.Description>
						{pendingRequest && (
							<div className={styles.pendingBox} data-flx="user.username-change-request-modal.pending-box">
								<p className={styles.pendingText} data-flx="user.username-change-request-modal.pending-text">
									<Trans>
										Waiting for the admin:{' '}
										<strong data-flx="user.username-change-request-modal.strong--2">
											{pendingRequest.requested_username}
										</strong>
										, asked on {getFormattedDateTime(pendingRequest.created_at)}. A new request replaces it.
									</Trans>
								</p>
								<Button
									variant="secondary"
									small
									submitting={isCancelling}
									onClick={handleCancelRequest}
									data-flx="user.username-change-request-modal.button.cancel-request"
								>
									<Trans>Cancel request</Trans>
								</Button>
							</div>
						)}
						{rejectedRequest && (
							<WarningAlert data-flx="user.username-change-request-modal.rejected-alert">
								<Trans>
									The admin rejected your request for{' '}
									<strong data-flx="user.username-change-request-modal.strong--3">
										{rejectedRequest.requested_username}
									</strong>
									.
								</Trans>
							</WarningAlert>
						)}
						<div className={styles.field} data-flx="user.username-change-request-modal.field">
							<span className={styles.fieldLabel} data-flx="user.username-change-request-modal.field-label">
								<Trans>New username</Trans>
							</span>
							{form.formState.errors.username && (
								<div className={styles.errorBox} role="alert" data-flx="user.username-change-request-modal.error-box">
									{form.formState.errors.username.message}
								</div>
							)}
							<Controller
								name="username"
								control={form.control}
								render={({field}) => (
									<Input
										data-flx="user.username-change-request-modal.input.text"
										{...field}
										ref={usernameRef}
										autoComplete="off"
										aria-label={i18n._(USERNAME_DESCRIPTOR)}
										placeholder={EXAMPLE_USERNAME}
										required={true}
										type="text"
									/>
								)}
								data-flx="user.username-change-request-modal.controller"
							/>
							<div className={styles.validationBox} data-flx="user.username-change-request-modal.validation-box">
								<UsernameValidationRules
									username={form.watch('username')}
									data-flx="user.username-change-request-modal.username-validation-rules"
								/>
							</div>
						</div>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer data-flx="user.username-change-request-modal.modal-footer">
					<Button
						onClick={ModalCommands.pop}
						variant="secondary"
						data-flx="user.username-change-request-modal.button.pop"
					>
						<Trans>Close</Trans>
					</Button>
					<Button type="submit" submitting={isSubmitting} data-flx="user.username-change-request-modal.button.submit">
						<Trans>Send request</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
