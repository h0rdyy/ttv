# Urgent: OnlineTable was temporarily broken

Apply the multi-select patch:

```bash
git checkout test/gm-combat-and-tokens
curl -sL https://cdn.jsdelivr.net/gh/h0rdyy/ttv@6cf6a1f2914073421e323d27ceb57a7a1eaa3e03/src/features/campaign/OnlineTable.tsx -o src/features/campaign/OnlineTable.tsx
# Then apply multi-select from the agent artifacts or wait for next push
npm run typecheck && npm test
```

Combat unlock (TabletopContextUi) is already correct on this branch.
CSS gm-token-bulk.css is already imported in layout.
