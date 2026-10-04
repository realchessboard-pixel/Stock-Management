import { z } from "zod";
import { identifierSchema, requiredText } from "./common";

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Use at least 8 characters")
  .max(128, "Password is too long");

export const signupSchema = z.object({
  businessName: requiredText("Shop name", 120),
  ownerName: requiredText("Your name", 120),
  identifier: identifierSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
