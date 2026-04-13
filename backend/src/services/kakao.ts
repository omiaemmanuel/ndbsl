/**
 * Kakao AlimTalk (알림톡) Notification Service
 *
 * Setup required:
 * 1. Create a KakaoTalk Business channel at https://business.kakao.com
 * 2. Register at KakaoTalk Developers → https://developers.kakao.com
 * 3. Create an app, enable KakaoTalk login
 * 4. Apply for AlimTalk (알림톡) sender profile
 * 5. Get approved message templates
 * 6. Add to .env:
 *      KAKAO_REST_API_KEY=your_rest_api_key
 *      KAKAO_ALIMTALK_SENDER_KEY=your_sender_key
 *      KAKAO_ALIMTALK_TEMPLATE_CODE_ANNOUNCEMENT=TMPL001
 *      KAKAO_ALIMTALK_TEMPLATE_CODE_BOOKING=TMPL002
 *
 * User flow:
 * - User logs in with KakaoTalk via OAuth
 * - Store kakao_user_id in app_users table
 * - Send AlimTalk notifications via the API
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface KakaoNotificationPayload {
  title: string;
  targetRole?: string; // 'admin' | 'professor' | 'member' | undefined (all)
  deepLink: string;    // e.g. '/admin/announcements' or '/member/requests'
  templateType: 'announcement' | 'booking' | 'procurement' | 'fault';
}

export async function sendKakaoNotification(payload: KakaoNotificationPayload): Promise<void> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  const senderKey = process.env.KAKAO_ALIMTALK_SENDER_KEY;

  if (!apiKey || !senderKey) {
    console.log(`[kakao] Not configured — skipping notification: "${payload.title}"`);
    return;
  }

  // Get target users
  const where: Record<string, unknown> = { active: true };
  if (payload.targetRole) where.role = payload.targetRole;

  const users = await prisma.appUser.findMany({
    where,
    select: { id: true, fullName: true },
  });

  const templateCode = {
    announcement: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_ANNOUNCEMENT,
    booking: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_BOOKING,
    procurement: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_PROCUREMENT,
    fault: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_FAULT,
  }[payload.templateType];

  if (!templateCode) {
    console.warn(`[kakao] No template code configured for type: ${payload.templateType}`);
    return;
  }

  const appBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const fullLink = `${appBaseUrl}${payload.deepLink}`;

  // In a real implementation, you would call the KakaoTalk AlimTalk API here:
  // POST https://kapi.kakao.com/v2/api/talk/memo/default/send
  // or use a third-party provider like CoolSMS, NCP, etc.
  //
  // Example message format (subject to template approval):
  // "새 공지사항이 등록되었습니다.\n\n[{title}]\n\n확인하기 → {link}"

  console.log(`[kakao] Would send "${payload.title}" to ${users.length} users → ${fullLink}`);
}

export async function notifyAnnouncement(announcementTitle: string, creatorRole: string): Promise<void> {
  // Announcement notifications go to all active users
  // Link points to landing page (public)
  await sendKakaoNotification({
    title: announcementTitle,
    deepLink: '/',
    templateType: 'announcement',
  });
}

export async function notifyProcurementStatus(requestTitle: string, newStatus: string, requestId: string, targetRole: string): Promise<void> {
  const deepLink = targetRole === 'member'
    ? '/member/requests'
    : targetRole === 'professor'
    ? '/professor/requests'
    : '/admin/procurement';

  await sendKakaoNotification({
    title: `Procurement: ${requestTitle} → ${newStatus}`,
    targetRole,
    deepLink,
    templateType: 'procurement',
  });
}

export async function notifyFaultReport(equipmentName: string, severity: string): Promise<void> {
  await sendKakaoNotification({
    title: `Fault reported: ${equipmentName} (${severity})`,
    targetRole: 'admin',
    deepLink: '/admin/faults',
    templateType: 'fault',
  });
}
