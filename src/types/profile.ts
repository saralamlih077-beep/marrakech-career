export interface ProfileData {
  full_name: string;
  job_title: string;
  phone: string;
  linkedin: string;
  address: string;
  education: string;
  experience: string;
  projects: string;
  languages: string;
  skills: string;
}

export const emptyProfile: ProfileData = {
  full_name: '',
  job_title: '',
  phone: '',
  linkedin: '',
  address: '',
  education: '',
  experience: '',
  projects: '',
  languages: '',
  skills: '',
};
