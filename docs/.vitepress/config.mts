// SPDX-License-Identifier: AGPL-3.0-or-later
import { withMermaid } from 'vitepress-plugin-mermaid';

// Base path comes from the environment so forks publish to their own Pages URL without edits (ADR-0010).
const base = process.env.DOCS_BASE ?? '/';
const repoUrl = process.env.DOCS_REPO_URL;

export default withMermaid({
	base,
	title: 'RestAssured',
	description: 'Asset management and cost forecasting for music clubs',
	cleanUrls: true,
	lastUpdated: true,
	srcExclude: ['scripts/**', 'README.md'],
	themeConfig: {
		search: { provider: 'local' },
		socialLinks: repoUrl ? [{ icon: 'github', link: repoUrl }] : [],
		footer: {
			message: 'Released under the GNU AGPL-3.0-or-later.'
		}
	},
	locales: {
		root: {
			label: 'English',
			lang: 'en',
			themeConfig: {
				nav: [
					{ text: 'Self-hosting', link: '/self-hosting/' },
					{ text: 'User guide', link: '/guide/' },
					{ text: 'Privacy', link: '/privacy/' },
					{ text: 'Architecture', link: '/architecture/' },
					{ text: 'Contributing', link: '/contributing/' }
				],
				sidebar: {
					'/architecture/': [
						{
							text: 'Architecture',
							items: [
								{ text: 'Overview', link: '/architecture/' },
								{ text: 'System specification', link: '/SYSTEM_SPEC' },
								{ text: 'Decisions (ADRs)', link: '/architecture/decisions/' }
							]
						}
					]
				}
			}
		},
		nl: {
			label: 'Nederlands',
			lang: 'nl',
			link: '/nl/',
			themeConfig: {
				nav: [
					{ text: 'Handleiding', link: '/nl/handleiding/' },
					{ text: 'Privacy', link: '/nl/privacy/' }
				],
				outline: { label: 'Op deze pagina' },
				docFooter: { prev: 'Vorige', next: 'Volgende' },
				lastUpdated: { text: 'Laatst bijgewerkt' }
			}
		}
	}
});
