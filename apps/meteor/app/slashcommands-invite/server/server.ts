import { TAPi18n } from 'meteor/rocketchat:tap-i18n';
import type { IUser, SlashCommandCallbackParams } from '@rocket.chat/core-typings';
import { api } from '@rocket.chat/core-services';
import { Subscriptions, Users } from '@rocket.chat/models';

import { settings } from '../../settings/server';
import { slashCommands } from '../../utils/lib/slashCommand';
import { addUsersToRoomMethod } from '../../lib/server/methods/addUsersToRoom';

/*
 * Invite is a named function that will replace /invite commands
 * @param {Object} message - The message object
 */
slashCommands.add({
	command: 'invite',
	callback: async ({ params, message, userId }: SlashCommandCallbackParams<'invite'>): Promise<void> => {
		const usernames = params
			.split(/[\s,]/)
			.map((username) => username.replace(/(^@)|( @)/, ''))
			.filter((a) => a !== '');
		if (usernames.length === 0) {
			return;
		}
		const users = await Users.find({
			username: {
				$in: usernames,
			},
		}).toArray();
		if (users.length === 0) {
			void api.broadcast('notify.ephemeralMessage', userId, message.rid, {
				msg: TAPi18n.__('User_doesnt_exist', {
					postProcess: 'sprintf',
					sprintf: [usernames.join(' @')],
					lng: settings.get('Language') || 'en',
				}),
			});
			return;
		}

		const usersFiltered: IUser[] = [];

		for await (const user of users) {
			const subscription = await Subscriptions.findOneByRoomIdAndUserId(message.rid, user._id, {
				projection: { _id: 1 },
			});
			if (subscription == null) {
				usersFiltered.push(user as IUser);
				continue;
			}
			const usernameStr = user.username as string;
			void api.broadcast('notify.ephemeralMessage', userId, message.rid, {
				msg: TAPi18n.__('Username_is_already_in_here', {
					postProcess: 'sprintf',
					sprintf: [usernameStr],
					lng: settings.get('Language') || 'en',
				}),
			});
		}

		await Promise.all(
			usersFiltered.map(async (user) => {
				try {
					return await addUsersToRoomMethod(userId, {
						rid: message.rid,
						users: [user.username || ''],
					});
				} catch ({ error }: any) {
					if (typeof error !== 'string') {
						return;
					}
					if (error === 'cant-invite-for-direct-room') {
						void api.broadcast('notify.ephemeralMessage', userId, message.rid, {
							msg: TAPi18n.__('Cannot_invite_users_to_direct_rooms', { lng: settings.get('Language') || 'en' }),
						});
					} else {
						void api.broadcast('notify.ephemeralMessage', userId, message.rid, {
							msg: TAPi18n.__(error, { lng: settings.get('Language') || 'en' }),
						});
					}
				}
			}),
		);
	},
	options: {
		description: 'Invite_user_to_join_channel',
		params: '@username',
		permission: 'add-user-to-joined-room',
	},
});
