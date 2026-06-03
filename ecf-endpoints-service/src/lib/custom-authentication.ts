import crypto from 'node:crypto';

import { DOMParser } from '@xmldom/xmldom';
import jwt from 'jsonwebtoken';
import * as xpath from 'xpath';

import type { P12ReaderData } from './p12-reader.js';
import Signature from './signature.js';

class CustomAuthentication {
  constructor(private readonly cert: P12ReaderData) {
    if (!cert.key || !cert.publicKey) {
      throw new Error('Certificate key and public key are required');
    }
  }

  generateSeed() {
    const randomValue = crypto.randomBytes(128).toString('base64');
    const date = new Date();
    const localDate = new Date(date.getTime() + -4 * 3600 * 1000);
    const formattedDate = localDate.toISOString().replace('Z', '-04:00');

    return `<?xml version="1.0" encoding="utf-8"?>
    <SemillaModel xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <valor>${randomValue}</valor>
        <fecha>${formattedDate}</fecha>
    </SemillaModel>`;
  }

  async verifySignedSeed(signedXml: string) {
    const doc = new DOMParser().parseFromString(signedXml, 'application/xml');
    const valorNode = xpath.select1('string(//SemillaModel/valor)', doc);
    const digestValue = xpath.select1("string(//*[local-name(.)='DigestValue'])", doc);
    const signatureValue = xpath.select1(
      "string(//*[local-name(.)='SignatureValue'])",
      doc
    );

    if (!valorNode || !digestValue || !signatureValue) {
      throw new Error('Required XML elements not found');
    }

    const calculatedDigest = await this.canonicalizeXml(signedXml);
    const expectedDigest = digestValue.toString().trim();

    if (calculatedDigest !== expectedDigest) {
      throw new Error(
        `Digest mismatch. Calculated: ${calculatedDigest}. Expected: ${expectedDigest}`
      );
    }

    return jwt.sign(
      {
        valor: valorNode.toString(),
        timestamp: new Date().toISOString(),
      },
      this.cert.key!,
      {
        algorithm: 'RS256',
        expiresIn: '1h',
      }
    );
  }

  private async canonicalizeXml(signedXml: string) {
    const doc = new DOMParser().parseFromString(signedXml, 'application/xml');
    const signatureNode = xpath.select1(
      "//*[local-name(.)='Signature']",
      doc
    ) as Node | null;

    if (signatureNode?.parentNode) {
      signatureNode.parentNode.removeChild(signatureNode);
    }

    const originalXml = doc.toString();
    const signature = new Signature(this.cert.key!, this.cert.cert!);
    const signedAgain = signature.signXml(originalXml, 'SemillaModel');
    const newDoc = new DOMParser().parseFromString(signedAgain, 'application/xml');
    return xpath.select1("string(//*[local-name(.)='DigestValue'])", newDoc);
  }
}

export default CustomAuthentication;