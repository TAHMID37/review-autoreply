-- When an auto-postable draft becomes eligible to post (draft time + rule delay).
ALTER TABLE "replies" ADD COLUMN "autoPostAt" TIMESTAMP(3);
