import { formatCurrency, formatDate } from "@/lib/utils";

export function buildInvoiceEmail({
  tenantName,
  unit,
  amount,
  period,
  dueDate,
  paymentUrl,
  landlordName,
}: {
  tenantName: string;
  unit: string;
  amount: number;
  period: string;
  dueDate: string;
  paymentUrl: string;
  landlordName: string;
}) {
  const subject = `Rent invoice — ${period} (${unit})`;

  const text = [
    `Hi ${tenantName},`,
    ``,
    `Here is your rent invoice for ${period}.`,
    ``,
    `Unit:    ${unit}`,
    `Amount:  ${formatCurrency(amount)}`,
    `Due:     ${formatDate(dueDate)}`,
    ``,
    `Pay here: ${paymentUrl}`,
    ``,
    `Thanks,`,
    `${landlordName}`,
    `via Mwenye Nyumba`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#faf8f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#faf8f3;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#ffffff;border:1px solid #e7e2d3;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="display:inline-block;padding:6px 10px;background:#1f2937;color:#faf8f3;border-radius:6px;font-weight:600;letter-spacing:0.02em;">m</div>
                <span style="margin-left:8px;font-weight:600;font-size:15px;letter-spacing:-0.01em;">Mwenye Nyumba</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Invoice</p>
                <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;">
                  Rent for ${period}
                </h1>
                <p style="margin:8px 0 0 0;color:#6b7280;">Hi ${tenantName}, here are the details.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#faf8f3;border:1px solid #ece6d4;border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #ece6d4;">
                      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Unit</div>
                      <div style="margin-top:2px;font-weight:500;">${unit}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #ece6d4;">
                      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Amount</div>
                      <div style="margin-top:2px;font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;">${formatCurrency(amount)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;">
                      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Due</div>
                      <div style="margin-top:2px;font-weight:500;">${formatDate(dueDate)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 32px 32px;">
                <a href="${paymentUrl}" style="display:inline-block;background:#f59e0b;color:#1f2937;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:8px;font-size:15px;">
                  Pay now
                </a>
                <p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">
                  Or copy this link:<br>
                  <span style="color:#1f2937;word-break:break-all;">${paymentUrl}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #ece6d4;background:#fbf9f2;">
                <p style="margin:0;font-size:13px;color:#6b7280;">
                  Sent by ${landlordName} via Mwenye Nyumba.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
