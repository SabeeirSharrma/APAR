import { getOne } from '../db/index.js';

// ============================================================================
// Email Service (§13)
// ============================================================================

export interface EmailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface ApprovalEmailData {
  applicantName: string;
  positionName: string;
  companyName: string;
  nextRoundName?: string;
  nextRoundDate?: string;
  nextRoundLocation?: string;
}

export interface RejectionEmailData {
  applicantName: string;
  positionName: string;
  companyName: string;
}

// --- Email Templates (§13) ---

/**
 * Build approval email HTML (§13 — includes next-step details when available).
 */
export function buildApprovalEmail(data: ApprovalEmailData): { subject: string; html: string; text: string } {
  const nextStepSection = data.nextRoundName
    ? `
      <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #0369a1;">Next Steps</h3>
        <p style="margin: 0; color: #334155;">
          ${data.nextRoundName ? `<strong>Round:</strong> ${data.nextRoundName}<br/>` : ''}
          ${data.nextRoundDate ? `<strong>Date/Time:</strong> ${data.nextRoundDate}<br/>` : ''}
          ${data.nextRoundLocation ? `<strong>Location:</strong> ${data.nextRoundLocation}` : ''}
        </p>
      </div>
    `
    : '';

  const subject = `${data.companyName} — Application Update for ${data.positionName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Application Update</h2>
      <p>Dear ${data.applicantName},</p>
      <p>We are pleased to inform you that your application for <strong>${data.positionName}</strong> at <strong>${data.companyName}</strong> has been <span style="color: #16a34a; font-weight: 600;">approved</span>.</p>
      ${nextStepSection}
      <p style="margin-top: 24px; color: #64748b; font-size: 14px;">This is an automated message. Please do not reply directly to this email.</p>
    </body>
    </html>
  `;
  const text = `Dear ${data.applicantName},\n\nYour application for ${data.positionName} at ${data.companyName} has been approved.${data.nextRoundName ? `\n\nNext Steps:\nRound: ${data.nextRoundName}${data.nextRoundDate ? `\nDate/Time: ${data.nextRoundDate}` : ''}${data.nextRoundLocation ? `\nLocation: ${data.nextRoundLocation}` : ''}` : ''}\n\nThis is an automated message.`;

  return { subject, html, text };
}

/**
 * Build rejection email HTML (§13).
 */
export function buildRejectionEmail(data: RejectionEmailData): { subject: string; html: string; text: string } {
  const subject = `${data.companyName} — Application Update for ${data.positionName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Application Update</h2>
      <p>Dear ${data.applicantName},</p>
      <p>Thank you for your interest in <strong>${data.positionName}</strong> at <strong>${data.companyName}</strong>. After careful review, we regret to inform you that your application has not been selected to proceed at this time.</p>
      <p>We appreciate your time and wish you the best in your future endeavors.</p>
      <p style="margin-top: 24px; color: #64748b; font-size: 14px;">This is an automated message. Please do not reply directly to this email.</p>
    </body>
    </html>
  `;
  const text = `Dear ${data.applicantName},\n\nThank you for your interest in ${data.positionName} at ${data.companyName}. After careful review, we regret to inform you that your application has not been selected to proceed at this time.\n\nWe appreciate your time and wish you the best in your future endeavors.\n\nThis is an automated message.`;

  return { subject, html, text };
}

/**
 * Build message notification email (§13 — anonymous interviewer↔applicant messaging).
 */
export function buildMessageEmail(data: {
  applicantName: string;
  companyName: string;
  positionName: string;
  messagePreview: string;
}): { subject: string; html: string; text: string } {
  const subject = `${data.companyName} — New message regarding your application for ${data.positionName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">New Message</h2>
      <p>Dear ${data.applicantName},</p>
      <p>You have received a new message regarding your application for <strong>${data.positionName}</strong> at <strong>${data.companyName}</strong>.</p>
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; color: #334155; font-style: italic;">${data.messagePreview}</p>
      </div>
      <p>Please log in to view and respond to this message.</p>
      <p style="margin-top: 24px; color: #64748b; font-size: 14px;">This is an automated message. Please do not reply directly to this email.</p>
    </body>
    </html>
  `;
  const text = `Dear ${data.applicantName},\n\nYou have received a new message regarding your application for ${data.positionName} at ${data.companyName}.\n\nMessage: ${data.messagePreview}\n\nPlease log in to view and respond to this message.\n\nThis is an automated message.`;

  return { subject, html, text };
}

// --- Email Sending ---

/**
 * Send an email. In development, logs to console.
 * In production, use a provider like Resend, SendGrid, or SMTP.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // In development, just log the email
  if (process.env.NODE_ENV !== 'production' || !process.env.SMTP_HOST) {
    console.log(`📧 [DEV] Email to: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Text: ${options.text || '(no text version)'}`);
    return true;
  }

  // Production: Use a real email provider
  // For now, we support basic SMTP via nodemailer if configured
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log(`📧 Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${options.to}:`, error);
    return false;
  }
}

/**
 * Send approval email to an applicant (§13).
 * Fetches company and position details, then sends the templated email.
 */
export async function sendApprovalEmail(
  applicationId: string,
  nextRoundDetails?: { roundName: string; date?: string; location?: string },
): Promise<boolean> {
  const app = getOne<{
    email: string;
    name: string;
    company_id: string;
    position_id: string;
  }>(
    'SELECT email, name, company_id, position_id FROM applications WHERE id = ?',
    { applicationId },
  );
  if (!app) return false;

  const company = getOne<{ name: string; submission_email: string }>(
    'SELECT name, submission_email FROM companies WHERE id = ?',
    { id: app.company_id },
  );
  if (!company) return false;

  const position = getOne<{ name: string }>(
    'SELECT name FROM positions WHERE id = ?',
    { id: app.position_id },
  );
  if (!position) return false;

  const { subject, html, text } = buildApprovalEmail({
    applicantName: app.name,
    positionName: position.name,
    companyName: company.name,
    nextRoundName: nextRoundDetails?.roundName,
    nextRoundDate: nextRoundDetails?.date,
    nextRoundLocation: nextRoundDetails?.location,
  });

  return sendEmail({
    to: app.email,
    from: company.submission_email,
    subject,
    html,
    text,
  });
}

/**
 * Send rejection email to an applicant (§13).
 */
export async function sendRejectionEmail(applicationId: string): Promise<boolean> {
  const app = getOne<{
    email: string;
    name: string;
    company_id: string;
    position_id: string;
  }>(
    'SELECT email, name, company_id, position_id FROM applications WHERE id = ?',
    { applicationId },
  );
  if (!app) return false;

  const company = getOne<{ name: string; submission_email: string }>(
    'SELECT name, submission_email FROM companies WHERE id = ?',
    { id: app.company_id },
  );
  if (!company) return false;

  const position = getOne<{ name: string }>(
    'SELECT name FROM positions WHERE id = ?',
    { id: app.position_id },
  );
  if (!position) return false;

  const { subject, html, text } = buildRejectionEmail({
    applicantName: app.name,
    positionName: position.name,
    companyName: company.name,
  });

  return sendEmail({
    to: app.email,
    from: company.submission_email,
    subject,
    html,
    text,
  });
}

/**
 * Send message notification email to an applicant (§13).
 */
export async function sendMessagNotificationEmail(
  applicationId: string,
  messagePreview: string,
): Promise<boolean> {
  const app = getOne<{
    email: string;
    name: string;
    company_id: string;
    position_id: string;
  }>(
    'SELECT email, name, company_id, position_id FROM applications WHERE id = ?',
    { applicationId },
  );
  if (!app) return false;

  const company = getOne<{ name: string; submission_email: string }>(
    'SELECT name, submission_email FROM companies WHERE id = ?',
    { id: app.company_id },
  );
  if (!company) return false;

  const position = getOne<{ name: string }>(
    'SELECT name FROM positions WHERE id = ?',
    { id: app.position_id },
  );
  if (!position) return false;

  const { subject, html, text } = buildMessageEmail({
    applicantName: app.name,
    companyName: company.name,
    positionName: position.name,
    messagePreview,
  });

  return sendEmail({
    to: app.email,
    from: company.submission_email,
    subject,
    html,
    text,
  });
}
