type DatingProfile = {
  gender: string | null;
  interestedIn: 'men' | 'women' | 'everyone' | null;
};

function acceptsGender(interestedIn: DatingProfile['interestedIn'], gender: DatingProfile['gender']) {
  if (!interestedIn || !gender) return false;
  if (interestedIn === 'everyone') return true;
  return interestedIn === 'men' ? gender === 'man' : gender === 'woman';
}

export function areDatingPreferencesCompatible(first: DatingProfile, second: DatingProfile) {
  return acceptsGender(first.interestedIn, second.gender)
    && acceptsGender(second.interestedIn, first.gender);
}