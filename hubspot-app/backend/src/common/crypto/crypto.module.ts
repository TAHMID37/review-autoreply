import { Global, Module } from "@nestjs/common";
import { SignedStateService } from "./signed-state.service";
import { TokenVaultService } from "./token-vault.service";

/** Global so the Google, HubSpot and billing modules share one token vault
 *  and one OAuth-state signer without importing each other. */
@Global()
@Module({
  providers: [TokenVaultService, SignedStateService],
  exports: [TokenVaultService, SignedStateService],
})
export class CryptoModule {}
