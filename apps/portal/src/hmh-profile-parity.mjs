function normalizeWallet(wallet) {
  return String(wallet ?? '').trim().toLowerCase();
}

function displayNameFromLocal(profile) {
  if (!profile) return '';
  if (profile.usernameSet && profile.handle) return String(profile.handle).trim();
  if (profile.displayName) return String(profile.displayName).trim();
  if (profile.handle) return String(profile.handle).trim();
  return '';
}

export function normalizeProfileIdentity({ wallet, localProfile = null, chainProfile = null } = {}) {
  const normalizedWallet = normalizeWallet(wallet ?? localProfile?.wallet);
  const localName = displayNameFromLocal(localProfile);
  const chainName = String(chainProfile?.displayName ?? '').trim();
  const displayName = localName || chainName || (normalizedWallet ? `Player ${normalizedWallet.slice(-4).toUpperCase()}` : 'Guest Player');
  const avatarDataUrl = typeof localProfile?.avatarDataUrl === 'string' ? localProfile.avatarDataUrl : '';
  const avatarUri = String(chainProfile?.avatarUri ?? localProfile?.avatarUri ?? '').trim();
  const selectedCharacterId = localProfile?.preferences?.selectedCharacterId ?? localProfile?.selectedCharacterId ?? null;
  return Object.freeze({
    wallet: normalizedWallet,
    displayName,
    handle: localProfile?.handle ?? displayName,
    usernameSet: Boolean(localProfile?.usernameSet || chainName),
    avatarDataUrl,
    avatarUri,
    selectedCharacterId,
    source: Object.freeze({
      displayName: localName ? 'local' : chainName ? 'chain' : 'fallback',
      avatar: avatarDataUrl ? 'local-data-url' : avatarUri ? 'chain-uri' : 'default',
      selectedCharacter: selectedCharacterId ? 'local-preference' : 'default',
    }),
    parity: Object.freeze({
      hasLocalProfile: Boolean(localProfile),
      hasChainProfile: Boolean(chainProfile),
      hasDisplayName: Boolean(displayName),
      hasAvatar: Boolean(avatarDataUrl || avatarUri),
      hasSelectedCharacter: Boolean(selectedCharacterId),
    }),
  });
}

export function buildProfilePersistenceParityReport({ state = null, wallet = null, chainProfile = null } = {}) {
  const localProfile = wallet ? state?.profiles?.[wallet] ?? state?.profiles?.[normalizeWallet(wallet)] ?? null : null;
  const identity = normalizeProfileIdentity({ wallet, localProfile, chainProfile });
  const snapshotReady = Boolean(identity.wallet && identity.displayName && (localProfile || chainProfile));
  const gaps = [];
  if (!identity.wallet) gaps.push('wallet missing');
  if (!identity.displayName) gaps.push('display name missing');
  if (localProfile && !('avatarDataUrl' in localProfile) && !identity.avatarUri) gaps.push('avatar has no persisted local or chain field');
  if (localProfile && !localProfile.preferences) gaps.push('profile preferences missing');
  return Object.freeze({
    version: 'wo-35-profile-parity-v1',
    wallet: identity.wallet,
    identity,
    summary: Object.freeze({
      snapshotReady,
      localProfilePresent: Boolean(localProfile),
      chainProfilePresent: Boolean(chainProfile),
      avatarParity: identity.parity.hasAvatar ? 'custom-or-chain' : 'default-avatar',
      selectedCharacterParity: identity.parity.hasSelectedCharacter ? 'local-preference' : 'default-character',
      status: gaps.length === 0 ? 'PASS' : 'NEEDS_PROFILE_DATA',
    }),
    gaps: Object.freeze(gaps),
  });
}

export function validateProfilePersistenceParity(report) {
  const gaps = [...(report?.gaps ?? [])];
  if (!report?.summary?.snapshotReady) gaps.push('profile snapshot is not ready');
  if (!report?.identity?.wallet) gaps.push('normalized wallet missing');
  if (!report?.identity?.displayName) gaps.push('display name missing');
  return Object.freeze({ ok: gaps.length === 0, gaps: Object.freeze(gaps), status: gaps.length === 0 ? 'PASS' : 'FAIL' });
}
