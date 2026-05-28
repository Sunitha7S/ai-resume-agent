/**
 * Structured resume data extracted from a resume document.
 * All fields are optional - "NA" is used when data is not found.
 */
export interface ResumeData {
  // Personal Details
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  marital_status: string;
  passport: string;
  hobbies: string;
  languages_known: string;

  // Communication Details
  address: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  mobile: string;
  email: string;

  // Qualification Details
  ssc_result: string;
  ssc_board: string;
  ssc_year_of_passing: string;
  hsc_result: string;
  hsc_board: string;
  hsc_year_of_passing: string;
  graduation_degree: string;
  graduation_result: string;
  graduation_university: string;
  graduation_year_of_passing: string;
  post_graduation_degree: string;
  post_graduation_result: string;
  post_graduation_university: string;
  post_graduation_year_of_passing: string;
  higher_education_qualification: string;

  // Employment Details
  total_work_experience_in: string;
  total_work_experience_months: string;
  number_of_companies_worked: string;
  last_employer: string;
}

export const EMPTY_RESUME: ResumeData = {
  first_name: "NA",
  middle_name: "NA",
  last_name: "NA",
  date_of_birth: "NA",
  gender: "NA",
  nationality: "NA",
  marital_status: "NA",
  passport: "NA",
  hobbies: "NA",
  languages_known: "NA",
  address: "NA",
  landmark: "NA",
  city: "NA",
  state: "NA",
  pincode: "NA",
  mobile: "NA",
  email: "NA",
  ssc_result: "NA",
  ssc_board: "NA",
  ssc_year_of_passing: "NA",
  hsc_result: "NA",
  hsc_board: "NA",
  hsc_year_of_passing: "NA",
  graduation_degree: "NA",
  graduation_result: "NA",
  graduation_university: "NA",
  graduation_year_of_passing: "NA",
  post_graduation_degree: "NA",
  post_graduation_result: "NA",
  post_graduation_university: "NA",
  post_graduation_year_of_passing: "NA",
  higher_education_qualification: "NA",
  total_work_experience_in: "NA",
  total_work_experience_months: "NA",
  number_of_companies_worked: "NA",
  last_employer: "NA",
};

export type ResumeField = keyof ResumeData;

export const ALL_RESUME_FIELDS: ResumeField[] = Object.keys(
  EMPTY_RESUME
) as ResumeField[];
