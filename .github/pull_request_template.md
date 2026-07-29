## Summary

Describe the outcome and the smallest coherent change that produces it.

## Security boundary

- Trust boundary changed:
- Record owner and ownership enforcement:
- Permission protecting the operation:
- Recent MFA requirement:
- Audit and outbox behavior:
- Secret or PII exposure:
- Retry and duplicate behavior:

## Verification

- [ ] Default denial is tested.
- [ ] Cross-owner access is tested where records have owners.
- [ ] Unknown and oversized input is tested.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes with production-shaped environment values.
- [ ] Prisma generation and validation pass when the schema changed.
- [ ] Documentation and ADRs remain accurate.
