import { pgEnum } from "drizzle-orm/pg-core";

export const role = pgEnum("role", [
  "student",
  "guardian",
  "volunteer",
  "school_champion",
  "state_lead",
  "programme_manager",
  "safeguarding_lead",
  "content_editor",
  "admin",
  "ekodara_officer",
]);
export const personStatus = pgEnum("person_status", [
  "pending_consent",
  "pending_review",
  "active",
  "waitlisted",
  "paused",
  "declined",
  "left",
  "anonymised",
]);
export const gender = pgEnum("gender", ["female", "male", "other", "prefer_not_to_say"]);
export const classLevel = pgEnum("class_level", ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3", "not_in_school"]);
export const language = pgEnum("language", ["en", "yo", "pcm"]);
export const channel = pgEnum("channel", ["whatsapp", "sms", "email"]);
export const consentType = pgEnum("consent_type", ["participation", "photo", "ai_practice", "stories"]);
export const consentMethod = pgEnum("consent_method", ["guardian_otp", "school_agreement", "self_adult", "paper_uploaded"]);
export const schoolOwnership = pgEnum("school_ownership", ["public", "private", "mission", "other"]);
export const schoolLevel = pgEnum("school_level", [
  "primary",
  "junior_secondary",
  "senior_secondary",
  "combined_secondary",
  "technical",
]);
export const partnershipStatus = pgEnum("partnership_status", [
  "none",
  "requested",
  "in_discussion",
  "agreement_signed",
  "active",
  "paused",
  "ended",
]);
export const programmeKind = pgEnum("programme_kind", ["debate", "stem", "education_access", "advocacy", "campaign", "other"]);
export const cohortStatus = pgEnum("cohort_status", ["draft", "open", "running", "completed", "cancelled"]);
export const cohortRole = pgEnum("cohort_role", ["student", "lead_coach", "assistant_coach"]);
export const sessionStatus = pgEnum("session_status", ["planned", "held", "cancelled"]);
export const attendanceStatus = pgEnum("attendance_status", ["present", "absent", "excused"]);
export const assessmentType = pgEnum("assessment_type", ["baseline", "endline", "follow_up_6m", "follow_up_12m"]);
export const volunteerStage = pgEnum("volunteer_stage", [
  "applied",
  "references_pending",
  "interview",
  "training",
  "active",
  "paused",
  "declined",
  "left",
]);
export const messageStatus = pgEnum("message_status", ["queued", "sent", "delivered", "read", "failed", "skipped"]);
export const messageDirection = pgEnum("message_direction", ["outbound", "inbound"]);
export const caseSeverity = pgEnum("case_severity", ["low", "medium", "high", "emergency"]);
export const caseStatus = pgEnum("case_status", ["new", "in_review", "action_taken", "referred", "closed"]);
export const caseCategory = pgEnum("case_category", [
  "physical",
  "emotional",
  "sexual",
  "neglect",
  "online",
  "bullying",
  "volunteer_conduct",
  "data_privacy",
  "other",
]);
export const taskStatus = pgEnum("task_status", ["open", "done", "dismissed"]);
export const contentStatus = pgEnum("content_status", ["draft", "published", "archived"]);
export const donationStatus = pgEnum("donation_status", ["initiated", "paid", "failed", "refunded"]);
export const donationFrequency = pgEnum("donation_frequency", ["one_off", "monthly"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "done", "failed"]);
export const speechStatus = pgEnum("speech_status", ["uploaded", "transcribing", "scoring", "done", "failed", "rejected"]);
export const dataRequestType = pgEnum("data_request_type", ["export", "erase", "correct"]);
export const dataRequestStatus = pgEnum("data_request_status", ["received", "verified", "in_progress", "done", "refused"]);
