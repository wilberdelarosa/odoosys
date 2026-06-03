import fs from 'node:fs';
import forge from 'node-forge';

export interface P12ReaderData {
  key: string | undefined;
  cert: string | undefined;
  publicKey?: string | undefined;
}

type Pkcs12Like = any;

class P12Reader {
  constructor(private readonly passphrase: string) {}

  private getCertificateFromP12(p12: Pkcs12Like) {
    const certData = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certificates = certData[forge.pki.oids.certBag];
    if (!certificates?.length || !certificates[0].cert) {
      throw new Error('Certificate not found');
    }

    return forge.pki.certificateToPem(certificates[0].cert);
  }

  private getKeyFromP12(p12: Pkcs12Like) {
    const certData = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    });
    const pkcs8Keys = certData[forge.pki.oids.pkcs8ShroudedKeyBag];
    const pkcs8Key = pkcs8Keys ? pkcs8Keys[0] : undefined;

    if (!pkcs8Key?.key) {
      throw new Error('Unable to get private key.');
    }

    return forge.pki.privateKeyToPem(pkcs8Key.key);
  }

  private getPublicKeyFromCert(certPem: string) {
    const cert = forge.pki.certificateFromPem(certPem);
    return forge.pki.publicKeyToPem(cert.publicKey);
  }

  getKeyFromFile(fileName: string): P12ReaderData {
    try {
      const p12File = fs.readFileSync(fileName, 'base64');
      const p12Der = forge.util.decode64(p12File);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, this.passphrase);

      const key = this.getKeyFromP12(p12);
      const cert = this.getCertificateFromP12(p12);
      const publicKey = cert ? this.getPublicKeyFromCert(cert) : undefined;

      return { key, cert, publicKey };
    } catch (error) {
      throw new Error(`${error}: revisa la ruta del .p12 y su password`);
    }
  }
}

export default P12Reader;