// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0009: every production dependency (incl. transitive) must have an allowed licence.
// "review" licences and unrecognised metadata need an explicit entry in .license-policy.json.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('.license-policy.json', 'utf8'));
const allow = new Set(policy.allow);
const deny = new Set(policy.deny);
const verified = policy.verified ?? {};
const reviewed = policy.reviewed ?? {};

const report = JSON.parse(
	execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8' }) || '{}'
);

/** Evaluates a simple SPDX expression: OR passes if any side passes, AND if all do. */
function isAllowed(expression) {
	const expr = expression.trim().replace(/^\((.*)\)$/, '$1');
	if (/\s+OR\s+/.test(expr)) return expr.split(/\s+OR\s+/).some(isAllowed);
	if (/\s+AND\s+/.test(expr)) return expr.split(/\s+AND\s+/).every(isAllowed);
	return allow.has(expr);
}

const problems = [];
let count = 0;
for (const [license, packages] of Object.entries(report)) {
	for (const pkg of packages) {
		for (const version of pkg.versions) {
			count++;
			const id = `${pkg.name}@${version}`;
			const effective = verified[id] ?? license;
			if (deny.has(effective)) problems.push(`${id}: forbidden licence ${effective}`);
			else if (!isAllowed(effective) && !reviewed[id]) {
				problems.push(
					`${id}: licence "${effective}" needs review (add to "reviewed" or "verified")`
				);
			}
		}
	}
}

if (problems.length) {
	console.error(`Licence check failed:\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log(`Licence check passed: ${count} production packages.`);
