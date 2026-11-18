import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { createApp, h } from 'vue';
import { RouterView } from 'vue-router';

import 'floating-vue/dist/style.css';

import { GameApiError } from '@/api/client.js';
import { router } from '@/router.js';
import '@/style.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof GameApiError && error.code === 'UPSTREAM_GAME_NOT_FOUND') {
          return false;
        }

        return failureCount < 1;
      },
      staleTime: 5_000,
    },
  },
});

createApp({ render: () => h(RouterView) })
  .use(router)
  .use(VueQueryPlugin, { queryClient })
  .mount('#app');
