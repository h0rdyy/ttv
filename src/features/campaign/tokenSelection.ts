export function nextTokenSelection(current: string[], tokenId: string, additive: boolean) {
  if (!additive) return [tokenId];
  return current.includes(tokenId)
    ? current.filter((id) => id !== tokenId)
    : [...current, tokenId];
}
