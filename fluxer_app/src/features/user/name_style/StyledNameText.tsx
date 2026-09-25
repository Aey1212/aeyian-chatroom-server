// SPDX-License-Identifier: AGPL-3.0-or-later

import {memberNamePaint, type NameRolePaint} from '@app/features/user/name_style/NamePaint';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface StyledNameTextProps {
	nameStyle: NameStyle | null | undefined;
	text: string;
	member?: {getColorRole(): NameRolePaint | undefined} | null;
	className?: string;
}

// Paints a name inside an element that already handles layout and truncation.
export const StyledNameText: React.FC<StyledNameTextProps> = observer(({nameStyle, text, member, className}) => {
	const paint = memberNamePaint(nameStyle, member, {text});
	if (!paint.className && !paint.style && !paint.lang && !className) return <>{text}</>;
	return (
		<span
			className={paint.className ? `${paint.className}${className ? ` ${className}` : ''}` : className}
			style={paint.style}
			lang={paint.lang}
			data-flx="user.name-style.styled-name-text"
		>
			{text}
		</span>
	);
});
