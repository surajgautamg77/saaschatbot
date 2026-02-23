import nodemailer from 'nodemailer';

// Helper function to ensure the URL has a protocol
const ensureProtocol = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `http://${url}`;
    }
    return url;
};

// 1. Check if the credentials are set
const isEmailConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_EMAIL;

if (!isEmailConfigured) {
    console.warn('*******************************************************************');
    console.warn('WARNING: SMTP_HOST, SMTP_USER, SMTP_PASS, or SMTP_EMAIL not set.');
    console.warn('Email invitations will be logged to the console instead of being sent.');
    console.warn('*******************************************************************');
}

// 2. Create a "transporter" object using generic SMTP settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true for 465, false for other ports
    auth: {
        // Use the USERNAME for authentication
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendInvitationEmail = async (toEmail: string, token: string) => {
    // 1. Get the base URL from the environment variable.
    // 2. Provide a safe fallback for development if the variable is missing.
    let baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    baseUrl = ensureProtocol(baseUrl); // Ensure protocol is present
    const invitationLink = `${baseUrl}/admin/join?token=${token}`;

    if (!isEmailConfigured) {
        // Fallback console log for development or missing config
        console.log(`
            ================================================================
            [DEV EMAIL] MEMBER INVITATION (SMTP Config Missing):
            To: ${toEmail}
            From: ${process.env.SMTP_EMAIL || 'Not Set'}
            Invitation Link: ${invitationLink}
            ================================================================
        `);
        return;
    }

    // 4. Define the email options
    const mailOptions = {
        // Use the SMTP_EMAIL for the "From" address
        from: `"RhysleyBot" <${process.env.SMTP_EMAIL}>`,
        to: toEmail,
        subject: 'You have been invited to join a team on RhysleyBot',
        html: `
            <h1>You're Invited!</h1>
            <p>You have been invited to join a team on the RhysleyBot platform.</p>
            <p>Click the link below to accept your invitation. This link is valid for 24 hours.</p>
            <a href="${invitationLink}" style="padding: 12px 24px; background-color: #ffd400; color: black; text-decoration: none; border-radius: 8px; font-weight: bold;">Accept Invitation</a>
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
        `,
    };

    // 5. Send the email
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Invitation email sent successfully to ${toEmail}`);
    } catch (error) {
        console.error(`Failed to send invitation email to ${toEmail}:`, error);
        // We still don't want to crash the whole invite process if the email fails.
    }
};