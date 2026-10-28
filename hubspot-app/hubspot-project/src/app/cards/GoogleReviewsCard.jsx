import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  EmptyState,
  Flex,
  Heading,
  Link,
  LoadingSpinner,
  Tag,
  Text,
  TextArea,
  hubspot,
} from "@hubspot/ui-extensions";
import { callApi } from "./api";

hubspot.extend(({ context }) => <GoogleReviewsCard context={context} />);

const STATUS = {
  GENERATED: { label: "Scheduled", variant: "default" },
  PENDING_APPROVAL: { label: "Waiting for approval", variant: "warning" },
  APPROVED: { label: "Approved, posting shortly", variant: "success" },
  POSTED: { label: "Posted on Google", variant: "success" },
  FAILED: { label: "Posting failed", variant: "error" },
  REJECTED: { label: "Not replying", variant: "default" },
};

/** "Google reviews" tab on a contact: every review saved under this contact. */
function GoogleReviewsCard({ context }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    callApi(`/hubspot/ext/contact-reviews?objectId=${context.crm.objectId}`, context)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [context]);

  useEffect(load, [load]);

  if (error) {
    return (
      <Alert title="Could not load Google reviews" variant="error">
        {error}
      </Alert>
    );
  }
  if (!data) return <LoadingSpinner label="Loading Google reviews" />;

  if (data.reviews.length === 0) {
    return (
      <EmptyState title="No Google reviews" layout="vertical">
        <Text>Reviews this person leaves on Google will appear here automatically.</Text>
      </EmptyState>
    );
  }

  return (
    <Flex direction="column" gap="medium">
      {data.reviews.some((r) => r.possibleDuplicate) && (
        <Alert title="Possible duplicate contact" variant="warning">
          More than one contact could be this reviewer, so this contact was created and flagged. If it is the same person as
          another contact, merge them.
        </Alert>
      )}
      {data.reviews.map((review, i) => (
        <React.Fragment key={review.id}>
          {i > 0 && <Divider />}
          <ReviewItem review={review} context={context} onChanged={load} />
        </React.Fragment>
      ))}
      <Link href={data.dashboardUrl}>Open the reviews dashboard</Link>
    </Flex>
  );
}

function ReviewItem({ review, context, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply ? review.reply.text : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const status = review.reply ? STATUS[review.reply.status] : null;

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await callApi(`/hubspot/ext/replies/${review.reply.id}/approve`, context, {
        method: "POST",
        body: { finalReply: text },
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Flex direction="column" gap="small">
      <Flex direction="row" gap="small" align="center" wrap="wrap">
        <Heading>{"★".repeat(review.rating) + "☆".repeat(5 - review.rating)}</Heading>
        <Text format={{ fontWeight: "demibold" }}>{review.locationName}</Text>
        <Text variant="microcopy">{new Date(review.reviewedAt).toLocaleDateString()}</Text>
        {review.removed && <Tag variant="default">Removed from Google</Tag>}
      </Flex>
      <Text>{review.text || "(No written comment)"}</Text>
      {review.googleUrl && <Link href={review.googleUrl}>View on Google</Link>}

      {review.reply && (
        <Flex direction="column" gap="extra-small">
          <Flex direction="row" gap="small" align="center">
            <Text format={{ fontWeight: "bold" }}>Our reply</Text>
            {status && <Tag variant={status.variant}>{status.label}</Tag>}
          </Flex>
          {editing ? (
            <TextArea label="Reply" name="reply" value={text} onChange={setText} rows={4} />
          ) : (
            <Text>{review.reply.text}</Text>
          )}
          {error && (
            <Alert title="Could not approve" variant="error">
              {error}
            </Alert>
          )}
          {review.reply.status === "PENDING_APPROVAL" && (
            <Flex direction="row" gap="small">
              <Button variant="primary" onClick={approve} disabled={busy || !text.trim()}>
                {busy ? "Approving…" : "Approve and post"}
              </Button>
              {!editing && <Button onClick={() => setEditing(true)}>Edit first</Button>}
            </Flex>
          )}
        </Flex>
      )}
    </Flex>
  );
}
