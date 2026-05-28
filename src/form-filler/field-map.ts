import type { ResumeField } from "../extraction/types.js";

/**
 * Maps form input names to resume data fields.
 * This handles the exact field names from the DataSort dashboard form.
 */
export interface FormFieldMapping {
  inputName: string;
  resumeField: ResumeField;
  inputType: "text" | "email" | "select";
  section: "personal" | "communication" | "qualification" | "employment";
  label: string;
}

export const FORM_FIELD_MAPPINGS: FormFieldMapping[] = [
  // Personal Details
  { inputName: "first_name", resumeField: "first_name", inputType: "text", section: "personal", label: "First Name" },
  { inputName: "middle_name", resumeField: "middle_name", inputType: "text", section: "personal", label: "Middle Name" },
  { inputName: "last_name", resumeField: "last_name", inputType: "text", section: "personal", label: "Last Name" },
  { inputName: "date_of_birth", resumeField: "date_of_birth", inputType: "text", section: "personal", label: "Date Of Birth" },
  { inputName: "gender", resumeField: "gender", inputType: "text", section: "personal", label: "Gender" },
  { inputName: "nationality", resumeField: "nationality", inputType: "text", section: "personal", label: "Nationality" },
  { inputName: "marital_status", resumeField: "marital_status", inputType: "text", section: "personal", label: "Marital Status" },
  { inputName: "passport", resumeField: "passport", inputType: "text", section: "personal", label: "Passport" },
  { inputName: "hobbies", resumeField: "hobbies", inputType: "text", section: "personal", label: "Hobbies" },
  { inputName: "languages_known", resumeField: "languages_known", inputType: "text", section: "personal", label: "Language Known" },

  // Communication Details
  { inputName: "address", resumeField: "address", inputType: "text", section: "communication", label: "Address" },
  { inputName: "landmark", resumeField: "landmark", inputType: "text", section: "communication", label: "Landmark" },
  { inputName: "city", resumeField: "city", inputType: "text", section: "communication", label: "City" },
  { inputName: "state", resumeField: "state", inputType: "text", section: "communication", label: "State" },
  { inputName: "pincode", resumeField: "pincode", inputType: "text", section: "communication", label: "Pincode" },
  { inputName: "mobile", resumeField: "mobile", inputType: "text", section: "communication", label: "Mobile" },
  { inputName: "email", resumeField: "email", inputType: "email", section: "communication", label: "Email" },

  // Qualification Details
  { inputName: "ssc_result", resumeField: "ssc_result", inputType: "text", section: "qualification", label: "SSC Result" },
  { inputName: "ssc_board", resumeField: "ssc_board", inputType: "text", section: "qualification", label: "SSC Board" },
  { inputName: "ssc_year_of_passing", resumeField: "ssc_year_of_passing", inputType: "text", section: "qualification", label: "SSC Pass Year" },
  { inputName: "hsc_result", resumeField: "hsc_result", inputType: "text", section: "qualification", label: "HSC Result" },
  { inputName: "hsc_board", resumeField: "hsc_board", inputType: "text", section: "qualification", label: "HSC Board" },
  { inputName: "hsc_year_of_passing", resumeField: "hsc_year_of_passing", inputType: "text", section: "qualification", label: "HSC Pass Year" },
  { inputName: "graduation_degree", resumeField: "graduation_degree", inputType: "text", section: "qualification", label: "Graduation Degree" },
  { inputName: "graduation_result", resumeField: "graduation_result", inputType: "text", section: "qualification", label: "Graduation Result" },
  { inputName: "graduation_university", resumeField: "graduation_university", inputType: "text", section: "qualification", label: "Graduation University" },
  { inputName: "graduation_year_of_passing", resumeField: "graduation_year_of_passing", inputType: "text", section: "qualification", label: "Graduation Year" },
  { inputName: "post_graduation_degree", resumeField: "post_graduation_degree", inputType: "text", section: "qualification", label: "Post Graduation Degree" },
  { inputName: "post_graduation_result", resumeField: "post_graduation_result", inputType: "text", section: "qualification", label: "Post Graduation Result" },
  { inputName: "post_graduation_university", resumeField: "post_graduation_university", inputType: "text", section: "qualification", label: "Post Graduation University" },
  { inputName: "post_graduation_year_of_passing", resumeField: "post_graduation_year_of_passing", inputType: "text", section: "qualification", label: "Post Graduation Year" },
  { inputName: "higher_education_qualification", resumeField: "higher_education_qualification", inputType: "text", section: "qualification", label: "Higher Level Education" },

  // Employment Details
  { inputName: "total_work_experience_In", resumeField: "total_work_experience_in", inputType: "select", section: "employment", label: "Total Work Experience In" },
  { inputName: "total_work_experience_months", resumeField: "total_work_experience_months", inputType: "text", section: "employment", label: "Total Work Experience (in months)" },
  { inputName: "number_of_companies_worked", resumeField: "number_of_companies_worked", inputType: "text", section: "employment", label: "No Of Companies" },
  { inputName: "last_employer", resumeField: "last_employer", inputType: "text", section: "employment", label: "Last Employer" },
];
