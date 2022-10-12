import { useQuery } from '@apollo/client';
import QueuedPublication from '@components/Publication/QueuedPublication';
import SinglePublication from '@components/Publication/SinglePublication';
import PublicationsShimmer from '@components/Shared/Shimmer/PublicationsShimmer';
import { Card } from '@components/UI/Card';
import { EmptyState } from '@components/UI/EmptyState';
import { ErrorMessage } from '@components/UI/ErrorMessage';
import { Spinner } from '@components/UI/Spinner';
import type { LensterPublication } from '@generated/lenstertypes';
import { HomeFeedDocument } from '@generated/types';
import { CollectionIcon } from '@heroicons/react/outline';
import { Mixpanel } from '@lib/mixpanel';
import type { FC } from 'react';
import { useRef } from 'react';
import { useState } from 'react';
import { useInView } from 'react-cool-inview';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import { PAGINATION_ROOT_MARGIN } from 'src/constants';
import { useAppStore } from 'src/store/app';
import { useTransactionPersistStore } from 'src/store/transaction';
import { PAGINATION } from 'src/tracking';

const Feed: FC = () => {
  const currentProfile = useAppStore((state) => state.currentProfile);
  const txnQueue = useTransactionPersistStore((state) => state.txnQueue);
  const publicationsRef = useRef<List>(null);
  const [stopIndex, setStopIndex] = useState<number | undefined>();

  // Variables
  const request = { profileId: currentProfile?.id, limit: 10 };
  const reactionRequest = currentProfile ? { profileId: currentProfile?.id } : null;
  const profileId = currentProfile?.id ?? null;

  const { data, loading, error, fetchMore } = useQuery(HomeFeedDocument, {
    variables: { request, reactionRequest, profileId }
  });

  const publications = data?.timeline?.items;
  const pageInfo = data?.timeline?.pageInfo;

  const { observe } = useInView({
    onChange: async ({ inView }) => {
      if (!inView && stopIndex && pageInfo && stopIndex < pageInfo.totalCount) {
        return;
      }

      await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next }, reactionRequest, profileId }
      });
      Mixpanel.track(PAGINATION.HOME_FEED);
    },
    rootMargin: PAGINATION_ROOT_MARGIN
  });

  const shouldShowSpinner =
    pageInfo?.next &&
    publications?.length !== pageInfo.totalCount &&
    stopIndex &&
    stopIndex > pageInfo.totalCount;

  if (loading) {
    return <PublicationsShimmer />;
  }

  if (publications?.length === 0) {
    return (
      <EmptyState
        message={<div>No posts yet!</div>}
        icon={<CollectionIcon className="w-8 h-8 text-brand" />}
      />
    );
  }

  if (error) {
    return <ErrorMessage title="Failed to load home feed" error={error} />;
  }

  return (
    <>
      <Card className="divide-y-[1px] dark:divide-gray-700/80 h-full">
        {txnQueue.map(
          (txn) =>
            txn?.type === 'NEW_POST' && (
              <div key={txn.id}>
                <QueuedPublication txn={txn} />
              </div>
            )
        )}

        {/*{publications?.map((publication, index: number) => (*/}
        {/*  <SinglePublication*/}
        {/*    key={`${publication?.id}_${index}`}*/}
        {/*    publication={publication as LensterPublication}*/}
        {/*  />*/}
        {/*))}*/}

        {/*{*/}
        {/*  txnQueue && (*/}
        {/*    <AutoSizer>*/}
        {/*      {({ height, width }) => (*/}
        {/*        <List*/}
        {/*          className="List"*/}
        {/*          height={height}*/}
        {/*          itemCount={txnQueue.length}*/}
        {/*          itemSize={10}*/}
        {/*          width={width}*/}
        {/*        >*/}
        {/*          {({ index, style }) => {*/}
        {/*            const tnxQueueItem = txnQueue[index];*/}
        {/*            if (tnxQueueItem.type === "NEW_POST") {*/}
        {/*              return  (*/}
        {/*                <div key={tnxQueueItem.id}>*/}
        {/*                  <QueuedPublication txn={tnxQueueItem} />*/}
        {/*                </div>*/}
        {/*              )*/}
        {/*            }*/}
        {/*            return <></>;*/}
        {/*          }}*/}
        {/*        </List>*/}
        {/*      )}*/}
        {/*    </AutoSizer>*/}
        {/*  )*/}
        {/*}*/}

        {publications && (
          <AutoSizer>
            {({ height, width }) => (
              <List
                className="List"
                itemCount={publications.length}
                itemSize={10} // Only show 10 publication items
                width={width}
                height={height}
                ref={publicationsRef}
                onItemsRendered={({ visibleStopIndex }) => {
                  setStopIndex(visibleStopIndex);
                }}
              >
                {({ index, style }) => {
                  const publication = publications[index];
                  return (
                    <SinglePublication
                      key={`${publication.id}_${index}`}
                      publication={publication as LensterPublication}
                    />
                  );
                }}
              </List>
            )}
          </AutoSizer>
        )}
      </Card>

      {pageInfo?.next && publications?.length !== pageInfo.totalCount && (
        <span ref={observe} className="flex justify-center p-5">
          <Spinner size="sm" />
        </span>
      )}
    </>
  );
};

export default Feed;
