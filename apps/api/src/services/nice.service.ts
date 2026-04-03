/**
 * NICE 체크플러스 본인인증 서비스
 *
 * 계약 및 자격증명 발급: https://www.niceapi.co.kr
 * 필요 환경변수:
 *   NICE_CLIENT_ID      — OAuth2 클라이언트 ID (NICE 발급)
 *   NICE_CLIENT_SECRET  — OAuth2 클라이언트 시크릿 (NICE 발급)
 *   NICE_PRODUCT_ID     — 이용 상품 ID (NICE 발급, 예: "2101979031")
 *   NICE_RETURN_URL     — 인증 결과를 수신할 콜백 URL (HTTPS 필수)
 */

import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../lib/logger';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const NICE_TOKEN_URL = 'https://svc.niceapi.co.kr:22001/digital/niceid/oauth/oauth/token';
const NICE_CRYPTO_URL = 'https://svc.niceapi.co.kr:22001/digital/niceid/api/v1.0/common/crypto/token';
const NICE_CHECK_URL = 'https://nice.checkplus.co.kr/CheckPlusSafeModel/checkplus.cb'; // 인증 실행 URL (팝업/리다이렉트)
const NICE_RESULT_URL = 'https://svc.niceapi.co.kr:22001/digital/niceid/api/v1.0/common/crypto/decrypt';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export interface NiceCryptoToken {
  token_val: string;   // 암호화 토큰 값
  req_dtim: string;    // 요청 일시 (YYYYMMDDHHmmss)
  req_no: string;      // 요청 번호
  enc_data: string;    // 암호화된 요청 데이터 (Base64)
  integrity_val: string; // 무결성 검증 값 (SHA256 해시)
}

export interface NiceVerifyResult {
  name: string;           // 이름
  utf8_name: string;      // UTF-8 이름
  birthdate: string;      // 생년월일 (YYYYMMDD)
  gender: '1' | '2';     // 성별 (1:남, 2:여)
  nationalinfo: '0' | '1'; // 내외국인 (0:내국인, 1:외국인)
  mobileco: string;       // 통신사 코드
  mobileno: string;       // 휴대폰 번호
  ci: string;             // 연계정보 (88바이트, 서비스 간 CI)
  di: string;             // 중복가입확인정보 (64바이트)
  receivedata: string;    // 수신 데이터 원문
}

export interface NiceEncryptedRequest {
  tokenVersionId: string;
  encData: string;
  integrityValue: string;
  checkUrl: string;
}

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────
export class NiceCheckPlusService {
  private clientId: string;
  private clientSecret: string;
  private productId: string;
  private returnUrl: string;

  constructor() {
    this.clientId = process.env.NICE_CLIENT_ID ?? '';
    this.clientSecret = process.env.NICE_CLIENT_SECRET ?? '';
    this.productId = process.env.NICE_PRODUCT_ID ?? '2101979031';
    this.returnUrl = process.env.NICE_RETURN_URL ?? `${process.env.API_BASE_URL}/api/users/age-verify/callback`;
  }

  get isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // ─────────────────────────────────────────────
  // STEP 1: OAuth2 Access Token 발급
  // ─────────────────────────────────────────────
  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const authHeader = Buffer.from(`${timestamp}:${this.clientId}`).toString('base64');

    const response = await axios.post(
      NICE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'default',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        timeout: 10_000,
      }
    );

    if (!response.data.dataHeader?.GW_RSLT_CD?.startsWith('1')) {
      throw new Error(`NICE token error: ${response.data.dataHeader?.GW_RSLT_MSG}`);
    }

    return response.data.dataBody.access_token;
  }

  // ─────────────────────────────────────────────
  // STEP 2: 암호화 토큰 발급 (요청별 1회용)
  // ─────────────────────────────────────────────
  private async getCryptoToken(accessToken: string, requestNo: string): Promise<NiceCryptoToken> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const clientAuth = crypto
      .createHash('sha256')
      .update(`${timestamp}:${this.clientId}:${accessToken}`)
      .digest('hex');

    const response = await axios.post(
      NICE_CRYPTO_URL,
      {
        dataHeader: { CNTY_CD: 'ko' },
        dataBody: {
          req_dtim: this.getReqDtim(),
          req_no: requestNo,
          enc_mode: '1', // AES-128 CBC
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `bearer ${accessToken}`,
          client_id: this.clientId,
          productID: this.productId,
        },
        timeout: 10_000,
      }
    );

    const body = response.data.dataBody;
    if (!body?.token_val) {
      throw new Error(`NICE crypto token error: ${JSON.stringify(response.data.dataHeader)}`);
    }

    return {
      token_val: body.token_val,
      req_dtim: body.req_dtim,
      req_no: body.req_no,
      enc_data: '',        // populated below
      integrity_val: '',   // populated below
    };
  }

  // ─────────────────────────────────────────────
  // STEP 3: 요청 데이터 AES-128-CBC 암호화
  // ─────────────────────────────────────────────
  private buildEncryptedRequest(
    token: NiceCryptoToken,
    requestNo: string,
    authType: 'M' | 'C' = 'M'  // M: 핸드폰, C: 신용카드
  ): NiceEncryptedRequest {
    // key = SHA256(token_val + req_dtim + req_no)[0:16]
    // iv  = SHA256(token_val + req_dtim + req_no)[16:32]
    const hash = crypto
      .createHash('sha256')
      .update(`${token.token_val}${token.req_dtim}${requestNo}`)
      .digest('hex');
    const key = Buffer.from(hash.substring(0, 32), 'hex'); // 16 bytes
    const iv = Buffer.from(hash.substring(32, 64), 'hex'); // 16 bytes

    // 요청 데이터 구성
    const plainData = [
      `requestno=${requestNo}`,
      `returnurl=${this.returnUrl}`,
      `sitecode=`,  // NICE 발급 사이트코드 (있을 경우)
      `authtype=${authType}`,
      `popupyn=Y`,
      `receivedata=`,
    ].join('&');

    // AES-128-CBC 암호화
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainData, 'utf8'),
      cipher.final(),
    ]);
    const encData = encrypted.toString('base64');

    // 무결성 검증값: SHA256(암호화키 + 암호화데이터)
    const integrityValue = crypto
      .createHash('sha256')
      .update(`${hash.substring(0, 32)}${encData}`)
      .digest('hex');

    return {
      tokenVersionId: token.token_val.substring(0, 10),
      encData,
      integrityValue,
      checkUrl: NICE_CHECK_URL,
    };
  }

  // ─────────────────────────────────────────────
  // PUBLIC: 인증 요청 생성 (initiate)
  // ─────────────────────────────────────────────
  async createVerifyRequest(requestNo: string): Promise<NiceEncryptedRequest> {
    if (!this.isConfigured) {
      throw new Error('NICE API credentials not configured. Set NICE_CLIENT_ID and NICE_CLIENT_SECRET.');
    }

    try {
      const accessToken = await this.getAccessToken();
      const cryptoToken = await this.getCryptoToken(accessToken, requestNo);
      return this.buildEncryptedRequest(cryptoToken, requestNo);
    } catch (err) {
      logger.error({ err }, 'NICE createVerifyRequest failed');
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // PUBLIC: 콜백 복호화 (callback)
  // ─────────────────────────────────────────────
  async decryptCallback(
    tokenVersionId: string,
    encData: string,
    integrityValue: string,
    requestNo: string,
  ): Promise<NiceVerifyResult> {
    // 무결성 검증은 서비스에서 저장한 암호화 키 해시로 수행
    // 여기서는 NICE 결과 복호화 API 활용
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        NICE_RESULT_URL,
        {
          dataHeader: { CNTY_CD: 'ko' },
          dataBody: {
            token_version_id: tokenVersionId,
            enc_data: encData,
            integrity_value: integrityValue,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `bearer ${accessToken}`,
            client_id: this.clientId,
            productID: this.productId,
          },
          timeout: 10_000,
        }
      );

      const body = response.data.dataBody;
      if (!body?.res_data) {
        throw new Error(`NICE decrypt error: ${JSON.stringify(response.data.dataHeader)}`);
      }

      // res_data는 JSON 문자열
      const result = typeof body.res_data === 'string'
        ? JSON.parse(body.res_data)
        : body.res_data;

      return result as NiceVerifyResult;
    } catch (err) {
      logger.error({ err }, 'NICE decryptCallback failed');
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  private getReqDtim(): string {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      String(d.getSeconds()).padStart(2, '0'),
    ].join('');
  }

  /** 나이 계산 (성인 여부 확인) */
  static isAdult(birthdate: string): boolean {
    if (!birthdate || birthdate.length !== 8) return false;
    const year = parseInt(birthdate.slice(0, 4));
    const month = parseInt(birthdate.slice(4, 6));
    const day = parseInt(birthdate.slice(6, 8));
    const now = new Date();
    const age = now.getFullYear() - year - (
      now.getMonth() + 1 < month ||
      (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0
    );
    return age >= 19;
  }
}

// 싱글턴
export const niceService = new NiceCheckPlusService();
