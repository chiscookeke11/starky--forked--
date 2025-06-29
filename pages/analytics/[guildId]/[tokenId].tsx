import React from "react";
import { Pie } from "react-chartjs-2";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { NextPageContext } from "next";
import Logo from "../../../components/Logo";
import SocialLinks from "../../../components/SocialLinks";
import RedirectMessage from "../../../components/RedirectMessage";
import { getDiscordServerInfo } from "../../../discord/utils";
import {
  DiscordMemberRepository,
  DiscordServerRepository,
  setupDb,
} from "../../../db";

import styles from "../../../styles/Verify.module.scss";
import { validateToken } from "../../../utils/validateToken";

// Register chart components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  LinearScale
);

interface AnalyticsPageProps {
  userStats: Record<string, number>;
  tokenExpired?: boolean;
  serverNotFound?: boolean;
  guildName?: string;
}

interface AnalyticsPageContext extends NextPageContext {
  query: {
    guildId: string;
    tokenId: string;
    guildName: string;
  };
}

const AnalyticsPage = ({
  userStats,
  tokenExpired,
  serverNotFound,
  guildName,
}: AnalyticsPageProps) => {
  if (tokenExpired) {
    return (
      <RedirectMessage
        title="Session Expired"
        description="Your access token has expired. You'll be redirected shortly."
        redirectTo="/"
      />
    );
  }

  if (serverNotFound) {
    return (
      <RedirectMessage
        title="Server Not Found"
        description="We could not find the server associated with this link. Redirecting to the home page."
        redirectTo="/"
      />
    );
  }

  const data = {
    labels: Object.keys(userStats),
    datasets: [
      {
        data: Object.values(userStats),
        backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
      },
    ],
  };

  return (
    <div>
      <div className={styles.verify}>
        <Logo />
      </div>
      <div className={styles.serverInfo}>
        <span>Server Analytics for Guild:</span>{" "}
        <b className={styles.serverDisplay}> {guildName}</b>
      </div>

      <div className={styles.sectionHeading}>
        <b>Distribution of networks among connected wallets:</b>
      </div>

      <div className={styles.chartContainer}>
        {Object.keys(userStats).length > 0 ? (
          <Pie
            data={data}
            options={{
              responsive: true,
              plugins: { legend: { position: "top" } },
            }}
          />
        ) : (
          <p className={styles.noDataMessage}>
            No user has connected their wallet at the moment.
          </p>
        )}
      </div>

      <div className={styles.sectionHeading}>
        <SocialLinks />
      </div>
    </div>
  );
};

export const getServerSideProps = async ({ query }: AnalyticsPageContext) => {
  await setupDb();
  const { guildId, tokenId } = query;

  if (!guildId || !tokenId) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const isValidToken = await validateToken(guildId, tokenId);

  if (!isValidToken) {
    return {
      props: { tokenExpired: true },
    };
  }

  const discordServer = await DiscordServerRepository.findOneBy({
    id: guildId,
  });

  if (!discordServer) {
    return {
      props: { serverNotFound: true },
    };
  }

  const guild = await getDiscordServerInfo(guildId);

  const guildName = guild.name;

  const members = await DiscordMemberRepository.findBy({
    discordServerId: guildId,
  });

  const userStats: Record<string, number> = {};
  members.forEach((member) => {
    const network = member.starknetNetwork.toLowerCase();
    userStats[network] = (userStats[network] || 0) + 1;
  });

  const formattedUserStats = Object.fromEntries(
    Object.entries(userStats).map(([network, count]) => [
      network.charAt(0).toUpperCase() + network.slice(1),
      count,
    ])
  );

  return {
    props: { userStats: formattedUserStats, guildName },
  };
};

export default AnalyticsPage;
