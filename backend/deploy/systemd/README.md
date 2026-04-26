# Systemd units for Basis production deployment

These files are deployed to `/etc/systemd/system/` on the EC2 instance running Basis.
They are NOT loaded by docker-compose, the API, or any local dev workflow — strictly EC2 boot/scheduling.

## Install (run on EC2 after `git pull`)

```bash
cd ~/Basis
sudo cp backend/deploy/systemd/*.service /etc/systemd/system/
sudo cp backend/deploy/systemd/*.timer /etc/systemd/system/
chmod +x backend/scripts/backup.sh backend/scripts/data_fresh_check.sh
sudo systemctl daemon-reload
sudo systemctl enable --now basis-postgres.service
sudo systemctl enable --now basis-collect.timer
sudo systemctl enable --now basis-backup.timer
sudo systemctl enable --now basis-data-fresh.timer
```

Verify:

```bash
sudo systemctl list-timers 'basis-*'
sudo systemctl status basis-postgres.service
```

## Configuration assumptions baked into these files

- Repo path: `/home/ubuntu/Basis`
- uv path: `/home/ubuntu/.local/bin/uv` (referenced indirectly via `collect_cron.sh`)
- `.env` at `/home/ubuntu/Basis/.env`, mode 600, contains: `DATABASE_URL`, `POSTGRES_PASSWORD`, `HC_PING_URL`, `HC_BACKUP_PING_URL`, `HC_DATA_FRESH_PING_URL`
- IAM role `basis-ec2-role` attached to instance with `ec2:DescribeSpotPriceHistory` and S3 RW perms
- S3 bucket `basis-backups-rajt-2026` (edit `backend/scripts/backup.sh` if a different name is used)

## Manual triggers (testing)

```bash
sudo systemctl start basis-collect.service
sudo systemctl start basis-backup.service
sudo systemctl start basis-data-fresh.service
journalctl -u basis-collect -n 50 --no-pager
```

## Catch-up behavior

`Persistent=true` means missed runs while the system was OFF (not while the timer was disabled) get caught up on next boot. Type=oneshot services show `inactive (dead)` after successful runs — that's normal, not a failure.
