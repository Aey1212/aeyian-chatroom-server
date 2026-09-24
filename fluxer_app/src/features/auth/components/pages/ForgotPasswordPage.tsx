// SPDX-License-Identifier: AGPL-3.0-or-later

import * as AuthenticationCommands from '@app/features/auth/commands/AuthenticationCommands';
import styles from '@app/features/auth/components/pages/ForgotPasswordPage.module.css';
import FormField from '@app/features/auth/flow/AuthFormField';
import {AuthRouterLink} from '@app/features/auth/flow/AuthRouterLink';
import {useAuthForm} from '@app/features/auth/hooks/useAuthForm';
import {resetOpenedPassword} from '@app/features/auth/state/AuthFlow';
import {
	BACK_TO_SIGN_IN_DESCRIPTOR,
	PASSWORD_DESCRIPTOR,
	REGISTER_DESCRIPTOR,
	USERNAME_OR_EMAIL_DESCRIPTOR,
} from '@app/features/i18n/utils/CommonMessageDescriptors';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {failureValidationErrors} from '@app/features/platform/utils/ResponseInspection';
import {Button} from '@app/features/ui/button/Button';
import {useFluxerDocumentTitle} from '@app/features/window/hooks/useFluxerDocumentTitle';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useId} from 'react';

const FORGOT_PASSWORD_DESCRIPTOR = msg({
	message: 'Forgot password',
	comment: 'Short label in the authentication forgot password page. Keep the tone plain and specific.',
});
const CONFIRM_PASSWORD_DESCRIPTOR = msg({
	message: 'Confirm password',
	comment: 'Label of the password confirmation field on the forgot password page.',
});
const PASSWORDS_DO_NOT_MATCH_DESCRIPTOR = msg({
	message: 'Passwords do not match',
	comment: 'Validation error on the forgot password page.',
});
const NO_PASSWORD_RESET_IS_OPEN_DESCRIPTOR = msg({
	message: 'No password reset is open for this account. Ask the admin to open one, then try again.',
	comment:
		'Error on the forgot password page when the admin has not opened a password reset for the account. There is no email reset.',
});

function isNoOpenResetError(error: unknown): boolean {
	return (failureValidationErrors(error) ?? []).some(
		(fault) => fault.path === 'login' && fault.code === ValidationErrorCodes.INVALID_OR_EXPIRED_RESET_TOKEN,
	);
}

const ForgotPasswordPage = observer(function ForgotPasswordPage() {
	const {i18n} = useLingui();
	const loginId = useId();
	const passwordId = useId();
	const confirmPasswordId = useId();
	useFluxerDocumentTitle(i18n._(FORGOT_PASSWORD_DESCRIPTOR));
	const {form, isLoading, fieldErrors} = useAuthForm({
		initialValues: {login: '', password: '', confirmPassword: ''},
		onSubmit: async (values) => {
			if (values.password !== values.confirmPassword) {
				form.setError('confirmPassword', i18n._(PASSWORDS_DO_NOT_MATCH_DESCRIPTOR));
				return;
			}
			let response: Awaited<ReturnType<typeof resetOpenedPassword>>;
			try {
				response = await resetOpenedPassword(values.login.trim(), values.password);
			} catch (error) {
				if (isNoOpenResetError(error)) {
					form.setError('login', i18n._(NO_PASSWORD_RESET_IS_OPEN_DESCRIPTOR));
					return;
				}
				throw error;
			}
			if (response.type === 'mfa') {
				AuthenticationCommands.setMfaTicket({
					ticket: response.challenge.ticket,
					totp: response.challenge.totp,
					webauthn: response.challenge.webauthn,
				});
				RouterUtils.replaceWith('/login');
				return;
			}
			await AuthenticationCommands.completeLogin(response.payload);
		},
		firstFieldName: 'login',
	});
	return (
		<>
			<h1 className={styles.title} data-flx="auth.forgot-password-page.title--2">
				<Trans>Forgot your password?</Trans>
			</h1>
			<p className={styles.description} data-flx="auth.forgot-password-page.description--2">
				<Trans>
					Ask the admin to open a password reset for your account. Once it is open, choose a new password here.
				</Trans>
			</p>
			<form className={styles.form} onSubmit={form.handleSubmit} data-flx="auth.forgot-password-page.form.submit">
				<FormField
					id={loginId}
					name="login"
					type="text"
					autoComplete="username"
					required
					label={i18n._(USERNAME_OR_EMAIL_DESCRIPTOR)}
					value={form.getValue('login')}
					onChange={(value) => form.setValue('login', value)}
					error={form.getError('login') || fieldErrors?.get('login')}
					data-flx="auth.forgot-password-page.form-field.set-value.login"
				/>
				<FormField
					id={passwordId}
					name="password"
					type="password"
					autoComplete="new-password"
					required
					label={i18n._(PASSWORD_DESCRIPTOR)}
					value={form.getValue('password')}
					onChange={(value) => form.setValue('password', value)}
					error={form.getError('password') || fieldErrors?.get('password')}
					data-flx="auth.forgot-password-page.form-field.set-value.password"
				/>
				<FormField
					id={confirmPasswordId}
					name="confirmPassword"
					type="password"
					autoComplete="new-password"
					required
					label={i18n._(CONFIRM_PASSWORD_DESCRIPTOR)}
					value={form.getValue('confirmPassword')}
					onChange={(value) => form.setValue('confirmPassword', value)}
					error={form.getError('confirmPassword')}
					data-flx="auth.forgot-password-page.form-field.set-value.confirm-password"
				/>
				<Button
					type="submit"
					fitContainer
					disabled={isLoading || form.isSubmitting}
					data-flx="auth.forgot-password-page.button.submit"
				>
					<Trans>Set new password</Trans>
				</Button>
			</form>
			<div className={styles.footer} data-flx="auth.forgot-password-page.footer--2">
				<div data-flx="auth.forgot-password-page.div">
					<AuthRouterLink to="/login" className={styles.link} data-flx="auth.forgot-password-page.link">
						{i18n._(BACK_TO_SIGN_IN_DESCRIPTOR)}
					</AuthRouterLink>
				</div>
				<div data-flx="auth.forgot-password-page.div--2">
					<span className={styles.footerLabel} data-flx="auth.forgot-password-page.footer-label">
						<Trans>Don't have an account?</Trans>{' '}
					</span>
					<AuthRouterLink
						to="/register"
						className={styles.primaryLink}
						data-flx="auth.forgot-password-page.primary-link--2"
					>
						{i18n._(REGISTER_DESCRIPTOR)}
					</AuthRouterLink>
				</div>
			</div>
		</>
	);
});

export default ForgotPasswordPage;
