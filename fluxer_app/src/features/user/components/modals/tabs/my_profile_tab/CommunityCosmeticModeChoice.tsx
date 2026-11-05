// SPDX-License-Identifier: AGPL-3.0-or-later

import {RadioGroup} from '@app/features/ui/radio_group/RadioGroup';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useMemo} from 'react';

// How a profile cosmetic behaves in one community: the global one, one picked for this community, or none.
export type CommunityCosmeticMode = 'inherit' | 'custom' | 'unset';

export interface CommunityCosmeticModeControl {
	mode: CommunityCosmeticMode;
	onModeChange: (mode: CommunityCosmeticMode) => void;
}

const USE_GLOBAL_PROFILE_DESCRIPTOR = msg({
	message: 'Use global profile',
	comment: 'Choice in a community profile: show the same cosmetic as the global profile. Keep it concise.',
});
const USE_GLOBAL_PROFILE_HINT_DESCRIPTOR = msg({
	message: 'Show the one from your global profile in this community',
	comment:
		'Description of the "Use global profile" choice for a name style, frame, nameplate or profile theme in a community profile.',
});
const CHOOSE_FOR_THIS_COMMUNITY_DESCRIPTOR = msg({
	message: 'Choose for this community',
	comment:
		'Choice in a community profile: pick a name style, frame, nameplate or profile theme just for this community. Keep it concise.',
});
const CHOOSE_FOR_THIS_COMMUNITY_HINT_DESCRIPTOR = msg({
	message: 'Pick one that only shows in this community',
	comment: 'Description of the "Choose for this community" choice in a community profile.',
});
const DONT_SHOW_DESCRIPTOR = msg({
	message: "Don't show",
	comment: 'Choice in a community profile: show no cosmetic of this kind in the community. Keep it concise.',
});
const DONT_SHOW_HINT_DESCRIPTOR = msg({
	message: 'Show none in this community, ignoring your global profile',
	comment:
		'Description of the "Don\'t show" choice for a name style, frame, nameplate or profile theme in a community profile.',
});

interface CommunityCosmeticModeChoiceProps extends CommunityCosmeticModeControl {
	label: string;
	disabled?: boolean;
}

export const CommunityCosmeticModeChoice = observer(
	({label, mode, onModeChange, disabled}: CommunityCosmeticModeChoiceProps) => {
		const {i18n} = useLingui();
		const options = useMemo(
			() => [
				{
					value: 'inherit' as CommunityCosmeticMode,
					name: i18n._(USE_GLOBAL_PROFILE_DESCRIPTOR),
					desc: i18n._(USE_GLOBAL_PROFILE_HINT_DESCRIPTOR),
				},
				{
					value: 'custom' as CommunityCosmeticMode,
					name: i18n._(CHOOSE_FOR_THIS_COMMUNITY_DESCRIPTOR),
					desc: i18n._(CHOOSE_FOR_THIS_COMMUNITY_HINT_DESCRIPTOR),
				},
				{
					value: 'unset' as CommunityCosmeticMode,
					name: i18n._(DONT_SHOW_DESCRIPTOR),
					desc: i18n._(DONT_SHOW_HINT_DESCRIPTOR),
				},
			],
			[i18n],
		);
		return (
			<RadioGroup
				options={options}
				value={mode}
				disabled={disabled}
				onChange={onModeChange}
				aria-label={label}
				data-flx="user.my-profile-tab.community-cosmetic-mode-choice.radio-group"
			/>
		);
	},
);
