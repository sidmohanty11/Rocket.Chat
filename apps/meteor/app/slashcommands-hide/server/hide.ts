import { TAPi18n } from 'meteor/rocketchat:tap-i18n';
import { api } from '@rocket.chat/core-services';
import { Subscriptions, Users, Rooms } from '@rocket.chat/models';
import type { SlashCommandCallbackParams } from '@rocket.chat/core-typings';

import { settings } from '../../settings/server';
import { slashCommands } from '../../utils/server';
import { hideRoomMethod } from '../../../server/methods/hideRoom';

/*
 * Hide is a named function that will replace /hide commands
 * @param {Object} message - The message object
 */

slashCommands.add({
	command: 'hide',
	callback: async ({ params, message, userId }: SlashCommandCallbackParams<'hide'>): Promise<void> => {
		const room = params.trim();
		if (!userId) {
			return;
		}

		const user = await Users.findOneById(userId);

		if (!user) {
			return;
		}

		const lng = user.language || settings.get('Language') || 'en';

		// if there is not a param, hide the current room
		let { rid } = message;
		if (room !== '') {
			const [strippedRoom] = room.replace(/#|@/, '').split(' ');

			const [type] = room;

			const roomObject =
				type === '#'
					? await Rooms.findOneByName(strippedRoom)
					: await Rooms.findOne({
							t: 'd',
							usernames: { $all: [user.username, strippedRoom] },
					  });
			if (!roomObject) {
				void api.broadcast('notify.ephemeralMessage', user._id, message.rid, {
					msg: TAPi18n.__('Channel_doesnt_exist', {
						postProcess: 'sprintf',
						sprintf: [room],
						lng,
					}),
				});
			}
			if (!(await Subscriptions.findOneByRoomIdAndUserId(roomObject._id, user._id, { projection: { _id: 1 } }))) {
				void api.broadcast('notify.ephemeralMessage', user._id, message.rid, {
					msg: TAPi18n.__('error-logged-user-not-in-room', {
						postProcess: 'sprintf',
						sprintf: [room],
						lng,
					}),
				});
				return;
			}
			rid = roomObject._id;
		}
		try {
			await hideRoomMethod(userId, rid);
		} catch (error: any) {
			await api.broadcast('notify.ephemeralMessage', user._id, message.rid, {
				msg: TAPi18n.__(error, { lng }),
			});
		}
	},
	options: { description: 'Hide_room', params: '#room' },
});
