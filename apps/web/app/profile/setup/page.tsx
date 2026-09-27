'use client';

import { apiUrl } from '@/lib/config';
import { FormEvent, useEffect, useState } from 'react';

const interestOptions = [
  'Music', 'Movies/Series', 'Gaming', 'Sports', 'Gym/Fitness', 'Travel',
  'Food', 'Reading', 'Coding/Tech', 'Finance', 'Other',
];

const lookingForOptions = [
  { value: 'dating', label: 'Dating' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'casual_dating', label: 'Casual dating' },
  { value: 'hookup', label: 'Hookup' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'open_to_see_where_it_goes', label: 'Open to see where it goes' },
] as const;

type InterestedIn = '' | 'men' | 'women' | 'everyone';
type LookingFor = '' | typeof lookingForOptions[number]['value'];
type Gender = '' | 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
type SetupForm = {
  displayName: string;
  age: string;
  gender: Gender;
  collegeId: string;
  courseId: string;
  academicYear: string;
  interestedIn: InterestedIn;
  lookingFor: LookingFor;
  interests: string[];
  bio: string;
  profilePhotoUrl: string;
};
type CollegeOption = { id: string; name: string; courses: { id: string; name: string }[] };
type SavedProfile = {
  displayName?: string;
  age?: number | null;
  gender?: Gender | null;
  collegeId?: string | null;
  courseId?: string | null;
  academicYear?: number | null;
  interestedIn?: InterestedIn | null;
  lookingFor?: LookingFor | null;
  interests?: string[] | null;
  bio?: string | null;
  profilePhotoUrl?: string | null;
};

const emptyForm: SetupForm = {
  displayName: '', age: '', gender: '', collegeId: '', courseId: '', academicYear: '',
  interestedIn: '', lookingFor: '', interests: [], bio: '', profilePhotoUrl: '',
};

export default function ProfileSetupPage() {
  const [form, setForm] = useState<SetupForm>(emptyForm);
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSetup() {
      try {
        const [profileResponse, optionsResponse] = await Promise.all([
          fetch(`${apiUrl}/api/v1/profile/me`, { credentials: 'include' }),
          fetch(`${apiUrl}/api/v1/profile/options`, { credentials: 'include' }),
        ]);
        if (profileResponse.status === 401 || optionsResponse.status === 401) {
          window.location.href = '/login';
          return;
        }
        const profileResult = await profileResponse.json() as { data?: { profile: SavedProfile | null }; error?: { message: string } };
        const optionsResult = await optionsResponse.json() as { data?: { colleges: CollegeOption[] }; error?: { message: string } };
        if (!profileResponse.ok || !profileResult.data || !optionsResponse.ok || !optionsResult.data) {
          throw new Error(profileResult.error?.message ?? optionsResult.error?.message ?? 'Unable to load profile setup.');
        }

        const profile = profileResult.data.profile;
        setColleges(optionsResult.data.colleges);
        if (profile) {
          setForm({
            displayName: profile.displayName ?? '',
            age: profile.age?.toString() ?? '',
            gender: profile.gender ?? '',
            collegeId: profile.collegeId ?? '',
            courseId: profile.courseId ?? '',
            academicYear: profile.academicYear?.toString() ?? '',
            interestedIn: profile.interestedIn ?? '',
            lookingFor: profile.lookingFor ?? '',
            interests: profile.interests ?? [],
            bio: profile.bio ?? '',
            profilePhotoUrl: profile.profilePhotoUrl ?? '',
          });
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load profile setup.');
      } finally {
        setLoading(false);
      }
    }
    void loadSetup();
  }, []);

  const selectedCollege = colleges.find((college) => college.id === form.collegeId);
  const courses = selectedCollege?.courses ?? [];

  function update<K extends keyof SetupForm>(key: K, value: SetupForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function continueStep() {
    setError('');
    if (step === 1) {
      const age = Number(form.age);
      if (form.displayName.trim().length < 2) return setError('Enter a display name with at least 2 characters.');
      if (!Number.isInteger(age) || age < 18) return setError('You must be at least 18 years old.');
      if (!form.gender || !form.collegeId || !form.courseId || ![1, 2, 3, 4].includes(Number(form.academicYear))) {
        return setError('Complete each required field to continue.');
      }
    }
    if (step === 2 && (!form.interestedIn || !form.lookingFor)) {
      return setError('Choose who you are interested in and what you are looking for.');
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (form.interests.length === 0) {
      setError('Choose at least one interest.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/profile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          academicYear: Number(form.academicYear),
          bio: form.bio.trim(),
          profilePhotoUrl: form.profilePhotoUrl.trim(),
        }),
      });
      const result = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Unable to save your profile.');
      window.location.href = '/discovery';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="setup-page"><p className="setup-loading">Loading your profile setup…</p></main>;

  return (
    <main className="setup-page">
      <header className="setup-heading">
        <span className="eyebrow">Your profile</span>
        <h1>Set the tone.</h1>
        <p>Start with what matters. You can update these details later.</p>
      </header>
      <section className="setup-panel" aria-labelledby="setup-step-title">
        <div className="setup-progress-row">
          <span className="eyebrow">Step {step} of 3</span>
          <div className="setup-progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={`Step ${step} of 3`}>
            <span style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
        <form onSubmit={(event) => void saveProfile(event)}>
          {step === 1 && <section className="setup-step">
            <h2 id="setup-step-title">The essentials</h2>
            <label className="setup-field">Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} autoComplete="nickname" maxLength={40} /></label>
            <div className="setup-grid">
              <label className="setup-field">Age<input type="number" inputMode="numeric" min={18} max={120} step={1} value={form.age} onChange={(event) => update('age', event.target.value)} /></label>
              <label className="setup-field">Gender<select value={form.gender} onChange={(event) => update('gender', event.target.value as Gender)}><option value="">Choose gender</option><option value="woman">Woman</option><option value="man">Man</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
            </div>
            <label className="setup-field">College<select value={form.collegeId} onChange={(event) => setForm((current) => ({ ...current, collegeId: event.target.value, courseId: '' }))}><option value="">Choose college</option>{colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select></label>
            <div className="setup-grid">
              <label className="setup-field">Course<select value={form.courseId} onChange={(event) => update('courseId', event.target.value)} disabled={!form.collegeId}><option value="">Choose course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
              <label className="setup-field">Academic year<select value={form.academicYear} onChange={(event) => update('academicYear', event.target.value)}><option value="">Choose year</option>{[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label>
            </div>
          </section>}
          {step === 2 && <section className="setup-step">
            <h2 id="setup-step-title">What feels right?</h2>
            <fieldset className="setup-fieldset"><legend>Interested in</legend><div className="setup-choice-row">{([{ value: 'men', label: 'Men' }, { value: 'women', label: 'Women' }, { value: 'everyone', label: 'Everyone' }] as const).map((option) => <button className={`setup-choice${form.interestedIn === option.value ? ' selected' : ''}`} type="button" aria-pressed={form.interestedIn === option.value} key={option.value} onClick={() => update('interestedIn', option.value)}>{option.label}</button>)}</div></fieldset>
            <label className="setup-field">Looking for<select value={form.lookingFor} onChange={(event) => update('lookingFor', event.target.value as LookingFor)}><option value="">Choose what you are looking for</option>{lookingForOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </section>}
          {step === 3 && <section className="setup-step">
            <h2 id="setup-step-title">A few more details</h2>
            <fieldset className="setup-fieldset"><legend>Interests <span>Choose at least one</span></legend><div className="setup-interest-grid">{interestOptions.map((interest) => { const selected = form.interests.includes(interest); return <button className={`setup-interest${selected ? ' selected' : ''}`} type="button" aria-pressed={selected} key={interest} onClick={() => update('interests', selected ? form.interests.filter((item) => item !== interest) : [...form.interests, interest])}>{interest}</button>; })}</div></fieldset>
            <label className="setup-field">Bio <span>Optional</span><textarea rows={4} maxLength={300} value={form.bio} onChange={(event) => update('bio', event.target.value)} /></label>
            <label className="setup-field">Profile photo URL <span>Optional</span><input type="url" inputMode="url" placeholder="https://…" value={form.profilePhotoUrl} onChange={(event) => update('profilePhotoUrl', event.target.value)} /></label>
          </section>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="setup-actions">
            {step > 1 && <button className="secondary-button" type="button" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</button>}
            {step < 3 ? <button className="primary-button" type="button" onClick={continueStep}>Continue</button> : <button className="primary-button" type="submit" disabled={busy || form.interests.length === 0}>{busy ? 'Saving…' : 'Save and discover'}</button>}
          </div>
        </form>
      </section>
    </main>
  );
}