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
import { Dogstats } from '@lib/dogstats';
import type { FC } from 'react';
import { useInView } from 'react-cool-inview';
import useVirtual from 'react-cool-virtual';
import { PAGINATION_ROOT_MARGIN } from 'src/constants';
import { useAppStore } from 'src/store/app';
import { useTransactionPersistStore } from 'src/store/transaction';
import { PAGINATION } from 'src/tracking';

const Feed: FC = () => {
  const currentProfile = useAppStore((state) => state.currentProfile);
  const txnQueue = useTransactionPersistStore((state) => state.txnQueue);

  // Variables
  const request = { profileId: currentProfile?.id, limit: 10 };
  const reactionRequest = currentProfile ? { profileId: currentProfile?.id } : null;
  const profileId = currentProfile?.id ?? null;

  const { data, loading, error, fetchMore } = useQuery(HomeFeedDocument, {
    variables: { request, reactionRequest, profileId }
  });

  const publications = data?.timeline?.items || [];
  const pageInfo = data?.timeline?.pageInfo;
  const totalPublicationPages = pageInfo?.totalCount || 0;

  const isItemLoadedArr: boolean[] = [];
  // We only have 50 (500 / 5) batches of items, so set the 51th (index = 50) batch as `true`
  // to avoid the `loadMore` callback from being invoked, yep it's a trick 😉
  isItemLoadedArr[totalPublicationPages] = true;

  console.log(pageInfo?.totalCount);

  const isItemLoaded = (index: number) => {
    return index < publications.length && publications[index] !== null;
  };

  const loadMore = async (value: { index: number }) => {
    console.log('Load more');
    console.log(publications);
    await fetchMore({
      variables: { request: { ...request, cursor: pageInfo?.next }, reactionRequest, profileId }
    });
    console.log(publications);
    Dogstats.track(PAGINATION.HOME_FEED);
    isItemLoadedArr[value.index] = true;
  };

  const { outerRef, innerRef, items } = useVirtual<HTMLDivElement, HTMLDivElement>({
    itemCount: pageInfo?.totalCount || 0,
    // The number of items that you want to load/or pre-load, it will trigger the `loadMore` callback
    // when the user scrolls within every items, e.g. 1 - 5, 6 - 10, and so on (default = 15)
    loadMoreCount: 10,
    // Provide the loaded state of a batch items to the callback for telling the hook
    // whether the `loadMore` should be triggered or not
    isItemLoaded: (loadIndex) => isItemLoadedArr[loadIndex],
    // We can fetch the data through the callback, it's invoked when more items need to be loaded
    loadMore: () => loadMore({ index: 1 })
  });

  const { observe } = useInView({
    onChange: async ({ inView }) => {
      if (!inView) {
        return;
      }

      await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next }, reactionRequest, profileId }
      });
      Dogstats.track(PAGINATION.HOME_FEED);
    },
    rootMargin: PAGINATION_ROOT_MARGIN
  });

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
    <div ref={outerRef} style={{ overflow: 'auto', height: '100%' }}>
      <Card className="outer divide-y-[1px] dark:divide-gray-700/80">
        {txnQueue.map(
          (txn) =>
            txn?.type === 'NEW_POST' && (
              <div key={txn.id}>
                <QueuedPublication txn={txn} />
              </div>
            )
        )}

        <div ref={innerRef}>
          {items.length
            ? items.map(({ index, measureRef }) => {
                // const showLoading = pageInfo?.next && publications?.length !== pageInfo.totalCount;
                const publication = publications[index];
                if (!publication) {
                  return null;
                }
                return (
                  <div key={`${publication.id}_${index}`}>
                    <div ref={measureRef}>
                      <SinglePublication publication={publication as LensterPublication} />
                    </div>
                  </div>
                );
              })
            : null}
        </div>

        {/*{publications?.map((publication, index: number) => (*/}
        {/*  <SinglePublication*/}
        {/*    key={`${publication?.id}_${index}`}*/}
        {/*    publication={publication as LensterPublication}*/}
        {/*  />*/}
        {/*))}*/}
      </Card>
      {pageInfo?.next && publications?.length !== pageInfo.totalCount && (
        <span ref={observe} className="flex justify-center p-5">
          <Spinner size="sm" />
        </span>
      )}
    </div>
  );
};

export default Feed;
