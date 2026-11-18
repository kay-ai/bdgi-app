// Generated from spec/08 §4. Edit the spec and regenerate, or edit here and update the spec.
export const messageTemplates = [
  {
    "key": "auth.otp",
    "category": "authentication",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Your BGDI code is {{code}}. It expires in 10 minutes. Don't share it.",
    "variables": [
      "code"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": true,
    "note": null
  },
  {
    "key": "student.welcome",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Hi {{firstName}}! Thank you for joining the Dream. We've asked {{guardianName}} for permission. We'll message you once you're placed in a group.",
    "variables": [
      "firstName",
      "guardianName"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "consent.request",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Hello {{guardianName}}. {{studentFirstName}} would like to join Black Girl's Dream Initiative, a free programme at {{schoolName}}. Please give your permission here: {{link}} Your code is {{code}}. Questions? Call {{orgPhone}}.",
    "variables": [
      "guardianName",
      "studentFirstName",
      "schoolName",
      "link",
      "code",
      "orgPhone"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "consent.reminder",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Reminder: {{studentFirstName}} is waiting for your permission to join BGDI. {{link}} Code: {{code}}",
    "variables": [
      "studentFirstName",
      "link",
      "code"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "consent.thanks",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you. {{studentFirstName}} can now take part in BGDI. You can change your choices any time: {{link}}",
    "variables": [
      "studentFirstName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "consent.declined_ack",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "We've recorded that you do not give permission for {{studentFirstName}}. We will not contact her further. If this was a mistake: {{link}}",
    "variables": [
      "studentFirstName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "consent.school_notice",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Hello. {{schoolName}} has enrolled {{studentFirstName}} in BGDI's {{programmeName}}, a free school activity. Learn more or opt out: {{link}}",
    "variables": [
      "schoolName",
      "studentFirstName",
      "programmeName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "consent.withdrawn",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "We've recorded that you have withdrawn permission for {{studentFirstName}}. She has been removed from BGDI activities.",
    "variables": [
      "studentFirstName"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "student.consent_given",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Good news, {{firstName}}! {{guardianName}} said yes. We're finding your group now.",
    "variables": [
      "firstName",
      "guardianName"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "student.placed",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "{{firstName}} is in! Group: {{cohortName}}. First session: {{date}} at {{time}}, {{venue}}. Coach: {{coachName}}.",
    "variables": [
      "firstName",
      "cohortName",
      "date",
      "time",
      "venue",
      "coachName"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "student.waitlisted",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "{{firstName}} is on our waiting list for {{programmeName}} at {{schoolName}}. We'll message you as soon as a group opens.",
    "variables": [
      "firstName",
      "programmeName",
      "schoolName"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "student.declined",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you for {{firstName}}'s interest in BGDI. We can't offer a place right now: {{reason}}. We'll keep in touch about future programmes.",
    "variables": [
      "firstName",
      "reason"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "session.reminder",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Reminder: {{programmeName}} {{when}} at {{time}}, {{venue}}. See you there!",
    "variables": [
      "programmeName",
      "when",
      "time",
      "venue"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": "(`when` = \"tomorrow\" or \"today\")"
  },
  {
    "key": "session.cancelled",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "{{programmeName}} on {{date}} is cancelled: {{reason}}. Next session: {{nextDate}}.",
    "variables": [
      "programmeName",
      "date",
      "reason",
      "nextDate"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "session.rescheduled",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "{{programmeName}} has moved to {{date}} at {{time}}, {{venue}}.",
    "variables": [
      "programmeName",
      "date",
      "time",
      "venue"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "student.quiet",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "We've missed {{firstName}} at the last {{count}} sessions of {{programmeName}}. Is everything okay? Reply to this message or call {{orgPhone}}.",
    "variables": [
      "firstName",
      "count",
      "programmeName",
      "orgPhone"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": "(sent only after staff approve the task)"
  },
  {
    "key": "student.endline",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "You did it, {{firstName}}! Take 2 minutes to tell us how you feel now: {{link}}",
    "variables": [
      "firstName",
      "link"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "student.completed",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "Congratulations! {{firstName}} has completed {{programmeName}}. Certificate: {{link}}",
    "variables": [
      "firstName",
      "programmeName",
      "link"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.application_received",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you for applying to volunteer with BGDI, {{firstName}}. Next we'll contact your references. Track your application: {{link}}",
    "variables": [
      "firstName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.interview_invite",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Hi {{firstName}}, your references are in. We'd like a short call. Please pick a time: {{link}}",
    "variables": [
      "firstName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": "(link = staff-entered scheduling URL or a prompt to reply)"
  },
  {
    "key": "volunteer.training_invite",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Welcome aboard, {{firstName}}! One last step: complete your safeguarding training (about 30 minutes): {{link}}",
    "variables": [
      "firstName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.activated",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "You're now an active BGDI volunteer. We'll message you when you're matched to a school. Your Hub: {{link}}",
    "variables": [
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.assigned",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "You've been matched to {{cohortName}} at {{schoolName}} as {{role}}. First session: {{date}} {{time}}. Details: {{link}}",
    "variables": [
      "cohortName",
      "schoolName",
      "role",
      "date",
      "time",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.declined",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you for your interest in volunteering with BGDI. We're unable to take your application forward at this time.",
    "variables": [],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.attendance_due",
    "category": "utility",
    "channels": [
      "whatsapp"
    ],
    "subjectEn": null,
    "bodyEn": "Please take attendance for {{cohortName}} on {{date}}: {{link}}",
    "variables": [
      "cohortName",
      "date",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.cohort_closed",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "{{cohortName}} is complete. Thank you! You logged {{hours}} hours. Certificate: {{link}}",
    "variables": [
      "cohortName",
      "hours",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "volunteer.hours_decision",
    "category": "utility",
    "channels": [
      "whatsapp"
    ],
    "subjectEn": null,
    "bodyEn": "Your {{hours}} hours on {{date}} were {{decision}}.",
    "variables": [
      "hours",
      "date",
      "decision"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "certificate.ready",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Your BGDI certificate is ready: {{link}}",
    "variables": [
      "link"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "school.request_received",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you, {{name}}. We've received {{schoolName}}'s request. A member of our team will call you within 5 working days.",
    "variables": [
      "name",
      "schoolName"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "school.accepted",
    "category": "utility",
    "channels": [
      "whatsapp",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Great news! BGDI would love to work with {{schoolName}}. Please review and sign the agreement: {{link}}",
    "variables": [
      "schoolName",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "event.registered",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "You're registered for {{eventTitle}} on {{date}} at {{venue}}. {{link}}",
    "variables": [
      "eventTitle",
      "date",
      "venue",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "event.reminder",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Reminder: {{eventTitle}} is tomorrow at {{time}}, {{venue}}.",
    "variables": [
      "eventTitle",
      "time",
      "venue"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "donation.receipt",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": "Thank you for your gift to BGDI",
    "bodyEn": "Thank you for your gift to Black Girl's Dream Initiative.\n\nAmount: {{amount}}\nDate: {{date}}\nWhere it goes: {{designation}}\nReference: {{reference}}\n\nYour receipt {{receiptCode}} is attached as a PDF. Anyone can check it at {{verifyUrl}}{{manage}}\n\nEvery BGDI programme is free for students and schools because of gifts like yours.",
    "variables": [
      "amount",
      "date",
      "designation",
      "reference",
      "receiptCode",
      "verifyUrl",
      "manage"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "donation.failed",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Your donation didn't go through. You can try again here: {{link}}",
    "variables": [
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "contact.auto_reply",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you for contacting BGDI. We've received your message and will reply within 3 working days.",
    "variables": [],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "newsletter.confirm",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Please confirm your subscription: {{link}}",
    "variables": [
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "staff.invite",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "You've been invited to the BGDI Hub as {{roles}}. Set your password: {{link}} (valid 72 hours)",
    "variables": [
      "roles",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "staff.password_reset",
    "category": "authentication",
    "channels": [
      "email"
    ],
    "subjectEn": "Reset your BGDI Hub password",
    "bodyEn": "Someone asked to reset the password for your BGDI Hub staff account. If it was you, set a new password here: {{link}} (valid 30 minutes). If it wasn't, you can ignore this email.",
    "variables": [
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": true,
    "note": "Added in M3 (spec/03 §1.3)"
  },
  {
    "key": "staff.locked",
    "category": "authentication",
    "channels": [
      "email"
    ],
    "subjectEn": "Your BGDI Hub account is locked for {{minutes}} minutes",
    "bodyEn": "There were five wrong sign-in attempts on your BGDI Hub staff account, so it is locked for {{minutes}} minutes. If this wasn't you, reset your password: {{link}}",
    "variables": [
      "minutes",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": true,
    "note": "Added in M3 (spec/03 §1.3)"
  },
  {
    "key": "staff.safeguarding_granted",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": "Safeguarding lead role granted",
    "bodyEn": "An admin has given the safeguarding lead role to another person in the BGDI Hub. Check the audit log in the console if you did not expect this.",
    "variables": [],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": "Added in M3 (spec/03 §4.1 note)"
  },
  {
    "key": "staff.digest",
    "category": "utility",
    "channels": [
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Daily list of open tasks and inbox counts",
    "variables": [],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "staff.case_new",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "New safeguarding concern {{reference}} ({{severity}}). Sign in to review: {{link}}",
    "variables": [
      "reference",
      "severity",
      "link"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": true,
    "note": "(no details in the message)"
  },
  {
    "key": "concern.received",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms",
      "email"
    ],
    "subjectEn": null,
    "bodyEn": "Thank you for telling us. Your reference is {{reference}}. Our safeguarding lead will review it. If someone is in immediate danger, call 112.",
    "variables": [
      "reference"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": true,
    "note": null
  },
  {
    "key": "system.opted_out",
    "category": "utility",
    "channels": [
      "whatsapp",
      "sms"
    ],
    "subjectEn": null,
    "bodyEn": "You won't receive more messages from BGDI. Reply START to turn them back on.",
    "variables": [],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "system.help",
    "category": "utility",
    "channels": [
      "whatsapp"
    ],
    "subjectEn": null,
    "bodyEn": "This is Black Girl's Dream Initiative. Visit {{siteUrl}} or call {{orgPhone}}. Reply STOP to stop messages.",
    "variables": [
      "siteUrl",
      "orgPhone"
    ],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "system.auto_reply",
    "category": "utility",
    "channels": [
      "whatsapp"
    ],
    "subjectEn": null,
    "bodyEn": "Thanks for your message. A member of the BGDI team will reply soon.",
    "variables": [],
    "allowBeforeConsent": true,
    "ignoresQuietHours": false,
    "note": null
  },
  {
    "key": "speech.result",
    "category": "utility",
    "channels": [
      "whatsapp"
    ],
    "subjectEn": null,
    "bodyEn": "Here's your scorecard, {{firstName}}! {{stars}} Pace: {{wpm}} wpm. Fillers: {{fillers}}. Well done: {{strength}} Next time: {{nextStep}} Full feedback: {{link}}",
    "variables": [
      "firstName",
      "stars",
      "wpm",
      "fillers",
      "strength",
      "nextStep",
      "link"
    ],
    "allowBeforeConsent": false,
    "ignoresQuietHours": false,
    "note": null
  }
] as const;
