// SPDX-License-Identifier: AGPL-3.0-or-later

import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import styles from '@app/features/user/components/modals/tabs/my_profile_tab/MyProfileTabUsernameSection.module.css';
import {UsernameChangeRequestModal} from '@app/features/user/components/modals/UsernameChangeRequestModal';
import type {User} from '@app/features/user/models/User';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const CLAIM_YOUR_ACCOUNT_TO_CHANGE_YOUR_USERNAME_DESCRIPTOR = msg({
	message: 'Claim your account to change your username',
	comment: 'Label in the username section.',
});

interface UsernameSectionProps {
	isClaimed: boolean;
	user: User;
}

export const UsernameSection = observer(({isClaimed, user}: UsernameSectionProps) => {
	const {i18n} = useLingui();
	return (
		<div data-flx="user.my-profile-tab.username-section.div">
			<div className={styles.label} data-flx="user.my-profile-tab.username-section.label">
				<Trans>Username</Trans>
			</div>
			<div className={styles.actions} data-flx="user.my-profile-tab.username-section.actions">
				{!isClaimed ? (
					<Tooltip
						text={i18n._(CLAIM_YOUR_ACCOUNT_TO_CHANGE_YOUR_USERNAME_DESCRIPTOR)}
						data-flx="user.my-profile-tab.username-section.tooltip"
					>
						<div data-flx="user.my-profile-tab.username-section.div--2">
							<Button variant="primary" small disabled data-flx="user.my-profile-tab.username-section.button">
								<Trans>Change username</Trans>
							</Button>
						</div>
					</Tooltip>
				) : (
					<Button
						variant="primary"
						small
						onClick={() =>
							ModalCommands.push(
								modal(() => (
									<UsernameChangeRequestModal
										user={user}
										data-flx="user.my-profile-tab.username-section.username-change-request-modal"
									/>
								)),
							)
						}
						data-flx="user.my-profile-tab.username-section.button.push"
					>
						<Trans>Change username</Trans>
					</Button>
				)}
			</div>
		</div>
	);
});
