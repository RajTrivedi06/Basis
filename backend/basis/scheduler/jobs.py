"""APScheduler job definitions for data collection and processing.

Schedules:
- Marketplace API collectors (Vast.ai, RunPod): twice daily
- Pricing page scrapes (Lambda, TensorDock): once daily
- AWS Spot history: daily
- Daily aggregation: once daily after all collectors complete
- Basis decomposition: once daily after aggregation
"""

# TODO: Set up APScheduler with the following jobs:
#
# from apscheduler.schedulers.asyncio import AsyncIOScheduler
#
# scheduler = AsyncIOScheduler()
#
# 1. Register each collector with appropriate cron triggers
# 2. Register aggregation job to run after collection window closes
# 3. Register decomposition job to run after aggregation
# 4. Add error handling -- failed jobs should log but not crash the scheduler
# 5. Wire scheduler startup/shutdown into FastAPI lifespan events
