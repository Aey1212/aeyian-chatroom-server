// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as AuthenticationCommands from '@app/features/auth/commands/AuthenticationCommands';
import {AuthRegisterFormCore} from '@app/features/auth/flow/AuthRegisterFormCore';
import type {ThemeType} from '@fluxer/constants/src/UserConstants';
import {observer} from 'mobx-react-lite';

interface AuthMinimalRegisterFormCoreProps {
	submitLabel: React.ReactNode;
	redirectPath: string;
	onRegister?: (response: AuthenticationCommands.TokenResponse) => Promise<void>;
	inviteCode?: string;
	extraContent?: React.ReactNode;
	theme?: ThemeType;
}

// Every account has a username and a password, so the invite, gift and theme sign-up pages
// use the full form.
export const AuthMinimalRegisterFormCore = observer(function AuthMinimalRegisterFormCore(
	props: AuthMinimalRegisterFormCoreProps,
) {
	return (
		<AuthRegisterFormCore data-flx="auth.flow.auth-minimal-register-form-core.auth-register-form-core" {...props} />
	);
});
