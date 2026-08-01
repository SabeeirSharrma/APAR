import { getOne, getMany } from '../db/index.js';

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

// --- Upload Confirmation Email (#5) ---

/**
 * Build upload confirmation email (#5).
 */
function buildUploadConfirmationEmail(data: {
  applicantName: string;
  positionName: string;
  companyName: string;
  applicationId: string;
}): { subject: string; html: string; text: string } {
  const subject = `${data.companyName} — Application Received for ${data.positionName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Application Submitted Successfully</h2>
      <p>Dear ${data.applicantName},</p>
      <p>Thank you for applying for <strong>${data.positionName}</strong> at <strong>${data.companyName}</strong>.</p>
      <p>We have received your application and it is now being processed. You will receive an email notification once the review is complete.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #64748b;">Your Application ID:</p>
        <p style="margin: 0; font-family: monospace; font-size: 16px; color: #0f172a; font-weight: 600;">${data.applicationId}</p>
      </div>
      <p style="color: #64748b; font-size: 13px;">Save this ID to check your application status.</p>
      <p style="margin-top: 24px; color: #64748b; font-size: 14px;">This is an automated message. Please do not reply directly to this email.</p>
    </body>
    </html>
  `;
  const text = `Dear ${data.applicantName},\n\nThank you for applying for ${data.positionName} at ${data.companyName}.\n\nWe have received your application and it is now being processed. You will receive an email notification once the review is complete.\n\nYour Application ID: ${data.applicationId}\n\nSave this ID to check your application status.\n\nThis is an automated message.`;

  return { subject, html, text };
}

/**
 * Send upload confirmation email to applicant (#5).
 */
export async function sendUploadConfirmation(
  applicationId: string,
  companyId: string,
  positionId: string,
  applicantEmail: string,
  applicantName: string,
): Promise<boolean> {
  const company = getOne<{ name: string; submission_email: string }>(
    'SELECT name, submission_email FROM companies WHERE id = ?',
    { id: companyId },
  );
  if (!company) return false;

  const position = getOne<{ name: string }>(
    'SELECT name FROM positions WHERE id = ?',
    { id: positionId },
  );
  if (!position) return false;

  const { subject, html, text } = buildUploadConfirmationEmail({
    applicantName,
    positionName: position.name,
    companyName: company.name,
    applicationId,
  });

  return sendEmail({
    to: applicantEmail,
    from: company.submission_email,
    subject,
    html,
    text,
  });
}

// --- Empty Pool Notification (#23) ---

/**
 * Build empty-pool notification email for admin (#23).
 */
function buildEmptyPoolNotification(data: {
  companyName: string;
  positionName: string;
  applicantName: string;
}): { subject: string; html: string; text: string } {
  const subject = `⚠️ ${data.companyName} — No Interviewers Available for ${data.positionName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <h2 style="color: #dc2626; margin: 0;">⚠️ Action Required</h2>
      </div>
      <h2 style="color: #0f172a;">Empty Interviewer Pool</h2>
      <p>An application from <strong>${data.applicantName}</strong> for position <strong>${data.positionName}</strong> is stuck in queue because there are no interviewers assigned to this position.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Company:</strong> ${data.companyName}</p>
        <p style="margin: 4px 0 0 0;"><strong>Position:</strong> ${data.positionName}</p>
        <p style="margin: 4px 0 0 0;"><strong>Applicant:</strong> ${data.applicantName}</p>
      </div>
      <p>Please assign at least one interviewer to this position to process the queued application.</p>
      <p style="margin-top: 24px; color: #64748b; font-size: 14px;">This is an automated notification from APAR.</p>
    </body>
    </html>
  `;
  const text = `⚠️ ACTION REQUIRED — Empty Interviewer Pool\n\nAn application from ${data.applicantName} for position ${data.positionName} is stuck in queue because there are no interviewers assigned to this position.\n\nCompany: ${data.companyName}\nPosition: ${data.positionName}\nApplicant: ${data.applicantName}\n\nPlease assign at least one interviewer to this position to process the queued application.\n\nThis is an automated notification from APAR.`;

  return { subject, html, text };
}

/**
 * Send empty-pool notification to all company admins (#23).
 * High-priority notification via email.
 */
export async function sendEmptyPoolNotification(
  companyId: string,
  positionId: string,
  applicantName: string,
): Promise<boolean> {
  const company = getOne<{ name: string; submission_email: string }>(
    'SELECT name, submission_email FROM companies WHERE id = ?',
    { id: companyId },
  );
  if (!company) return false;

  const position = getOne<{ name: string }>(
    'SELECT name FROM positions WHERE id = ?',
    { id: positionId },
  );
  if (!position) return false;

  // Get all admin emails for this company
  const admins = getMany<{ email: string }>(
    'SELECT email FROM company_admins WHERE company_id = ?',
    { companyId },
  );

  if (admins.length === 0) return false;

  const { subject, html, text } = buildEmptyPoolNotification({
    companyName: company.name,
    positionName: position.name,
    applicantName,
  });

  // Send to all admins
  let allSent = true;
  for (const admin of admins) {
    const sent = await sendEmail({
      to: admin.email,
      from: company.submission_email,
      subject,
      html,
      text,
    });
    if (!sent) allSent = false;
  }

  return allSent;
}

/**
 * Send round advancement confirmation email to applicant (#10).
 */
export async function sendRoundAdvancementEmail(
  applicationId: string,
  roundName: string,
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

  const subject = `${company.name} — You've Advanced to the Next Round for ${position.name}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a;">Congratulations!</h2>
      <p>Dear ${app.name},</p>
      <p>We are pleased to inform you that your application for <strong>${position.name}</strong> at <strong>${company.name}</strong> has advanced to the next round.</p>
      <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Next Round:</strong> ${roundName}</p>
      </div>
      <p>You will receive further instructions soon. Please monitor your email for updates.</p>
      <p style="margin-top: 24px; color: #64748b; font-size: 14px;">This is an automated message. Please do not reply directly to this email.</p>
    </body>
    </html>
  `;
  const text = `Dear ${app.name},\n\nWe are pleased to inform you that your application for ${position.name} at ${company.name} has advanced to the next round.\n\nNext Round: ${roundName}\n\nYou will receive further instructions soon.\n\nThis is an automated message.`;

  return sendEmail({
    to: app.email,
    from: company.submission_email,
    subject,
    html,
    text,
  });
}
