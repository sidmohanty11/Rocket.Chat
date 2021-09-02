import { Migrations } from '../../../app/migrations/server';
import { isEnterprise } from '../../../ee/app/license/server';
import { Users, Settings } from '../../../app/models/server/raw';
import { Banner } from '../../sdk';
import { BannerPlatform } from '../../../definition/IBanner';
import { IUser } from '../../../definition/IUser';

Migrations.add({
	version: 232,
	up() {
		const query = {
			_id: { $in: [/^Accounts_OAuth_Custom-?([^-_]+)$/, 'Accounts_OAuth_GitHub_Enterprise'] },
			value: true,
		};

		const isCustomOAuthEnabled = !!Settings.findOne(query);

		const isEE = isEnterprise();

		if (!isEE && isCustomOAuthEnabled) {
			return;
		}

		console.log('its enterprise');

		const admins = Promise.await(Users.find<IUser>({ roles: 'admin' }, {}).toArray());

		const banners = admins.map((a) => Promise.await(Banner.getNewBannersForUser(a._id, BannerPlatform.Web))).flat();
		const msg = 'Please notice that after the next release (4.0) advanced functionalities of LDAP, SAML, and Custom Oauth will be available only in Enterprise Edition and Gold plan. Check the official announcement for more info: https://go.rocket.chat/i/authentication-changes';
		// @ts-ignore
		const authBanner = banners.find((b) => b.view.blocks[0].text.text === msg);

		if (!authBanner) {
			return;
		}

		admins.map((a) => Banner.dismiss(a._id, authBanner._id));
	},
});
