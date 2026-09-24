// SPDX-License-Identifier: AGPL-3.0-or-later
import QRCode from 'qrcode';

/** SVG markup for a QR code of `url`, for handing over one-time links in person (ADR-0004). */
export function qrSvg(url: string): Promise<string> {
	return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}
