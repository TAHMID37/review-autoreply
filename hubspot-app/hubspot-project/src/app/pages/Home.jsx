import React, { useEffect, useState } from "react";
import { Alert, Button, Flex, Heading, LoadingSpinner, Statistics, StatisticsItem, Text, hubspot } from "@hubspot/ui-extensions";
import { callApi } from "./api";

hubspot.extend(({ context }) => <Home context={context} />);

/** The app's home page inside HubSpot: headline numbers and setup progress. */
function Home({ context }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    callApi("/hubspot/ext/summary", context).then(setData).catch((e) => setError(e.message));
  }, [context]);

  if (error) {
    return (
      <Alert title="Finish installing" variant="warning">
        {error} Open the app from the Marketplace listing to complete setup.
      </Alert>
    );
  }
  if (!data) return <LoadingSpinner label="Loading" />;

  const { setup } = data;
  const setupDone = setup.googleConnected && setup.locationsSelected > 0;

  return (
    <Flex direction="column" gap="large">
      <Heading>{data.businessName}: Google reviews</Heading>

      {!setupDone && (
        <Alert title="Finish setting up" variant="info">
          <Flex direction="column" gap="small">
            <Text>Connect your Google Business Profile and pick your locations to start syncing reviews.</Text>
            <Button href={data.setupUrl} variant="primary">
              Continue setup
            </Button>
          </Flex>
        </Alert>
      )}

      <Statistics>
        <StatisticsItem label="Google reviews" number={String(data.totalReviews)} />
        <StatisticsItem label="Average rating" number={data.averageRating.toFixed(1)} />
        <StatisticsItem label="Response rate" number={`${data.responseRate}%`} />
        <StatisticsItem label="Waiting for approval" number={String(data.pendingApproval)} />
      </Statistics>

      <Text>
        Auto-replies are <Text inline format={{ fontWeight: "bold" }}>{setup.autoReplyEnabled ? "on" : "off"}</Text>. Each review
        is saved as a note on the reviewer's contact.
      </Text>

      <Flex direction="row" gap="small">
        <Button href={data.dashboardUrl} variant="primary">
          Open dashboard
        </Button>
        {data.pendingApproval > 0 && <Button href={data.alertsUrl}>Review {data.pendingApproval} waiting</Button>}
      </Flex>
    </Flex>
  );
}
