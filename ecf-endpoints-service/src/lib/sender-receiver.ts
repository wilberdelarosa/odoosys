import { DOMParser } from '@xmldom/xmldom';
import { js2xml } from 'xml-js';

import { getCurrentFormattedDateTime } from './date.js';

export enum NoReceivedCode {
  ErrorDeEspecificacion = '1',
  ErrorDeFirmaDigital = '2',
  EnvioDuplicado = '3',
  RncCompradorNoCorresponde = '4',
}

export enum ReceivedStatus {
  Recibido = '0',
  NoRecibido = '1',
}

const excludedEncfType = ['32', '41', '43', '45', '46', '47'];

export class SenderReceiver {
  getECFDataFromXML(
    xml: string | Document,
    receptorRNC: string,
    status: ReceivedStatus,
    code?: NoReceivedCode
  ) {
    const xmlDoc =
      typeof xml === 'string'
        ? new DOMParser().parseFromString(xml, 'text/xml')
        : xml;

    const eNCF = xmlDoc.getElementsByTagName('eNCF')[0]?.textContent || '';
    const tipoeCF = xmlDoc.getElementsByTagName('TipoeCF')[0]?.textContent || '';
    const rncEmisor = xmlDoc.getElementsByTagName('RNCEmisor')[0]?.textContent || '';
    const rncComprador =
      xmlDoc.getElementsByTagName('RNCComprador')[0]?.textContent || '';

    if (tipoeCF && excludedEncfType.includes(tipoeCF)) {
      code = NoReceivedCode.ErrorDeEspecificacion;
      status = ReceivedStatus.NoRecibido;
    }

    if (receptorRNC !== rncComprador) {
      code = NoReceivedCode.RncCompradorNoCorresponde;
      status = ReceivedStatus.NoRecibido;
    }

    const data: Record<string, unknown> = {
      _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
      ARECF: {
        _attributes: {
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
        },
        DetalleAcusedeRecibo: {
          Version: { _text: '1.0' },
          RNCEmisor: { _text: rncEmisor },
          RNCComprador: { _text: rncComprador },
          eNCF: { _text: eNCF },
          Estado: { _text: status },
          CodigoMotivoNoRecibido: code ? { _text: code } : undefined,
          FechaHoraAcuseRecibo: { _text: getCurrentFormattedDateTime() },
        },
      },
    };

    if (!code) {
      delete (data.ARECF as { DetalleAcusedeRecibo: Record<string, unknown> })
        .DetalleAcusedeRecibo.CodigoMotivoNoRecibido;
    }

    return js2xml(data, { compact: true, ignoreComment: true, spaces: 4 });
  }
}