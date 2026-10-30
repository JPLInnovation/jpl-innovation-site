# 10951 robot update

Source: `CAD/10951_robot.glb`. Rebuild lightweight geometry with `python scripts/kitbot-cad.py`.
The active site and every consumer of buildRobot use this single generated geometry file. Archived site copies are not deployment sources.

The CAD names identify a REV NEO V1.1 on the indexer, two Kraken X60 motors and their intake/flywheel belt paths. Rotor axes remain extracted from KB-26002 shafts. Names are retained for feature selection.

Scroll follows one yellow FUEL ball from intake to hopper to indexer to flywheel. Mechanism time is derived from scroll weights and reverses with scrolling; the plain viewer retains an idle loop. Motion is illustrative, not calibrated physics or measured RPM.

Hopper: the two named pivot blocks have centres near y=0.499 m, z=-0.279 m. The extension and rear lettering move as a unit about their shared x axis. The 90-degree folded pose is provisional: the GLB has no animation or joint limits. Confirm the closing direction and angle with the team before treating this as an engineering demonstration.

Hardware references (checked 2026-10-30):
- https://wcproducts.com/products/kraken ? WCP motor, integrated CTRE Talon FX, encoder.
- https://docs.limelightvision.io/docs/docs-limelight/pipeline-apriltag/apriltag-robot-localization-megatag2 ? heading, camera transform and field map requirements.
- https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/pigeon2/index.html ? Pigeon hardware.
- https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/differential-drive-odometry.html ? heading plus left/right wheel distances. The IMU alone is not position tracking.

Design: retain the existing FRC chapter composition and native scroll driver; the robot's FUEL path is the repeated motif. New captions and camera stops carry the mechanism sequence. No second animation driver is introduced. Existing photography and page typography remain in place. The broad design inspector flags legacy typography and section styling outside this change; this work targets the robot chapter.

Team hardware clarification: Limelight 4+ and Kraken X60. Official Limelight documentation currently names the product Limelight 4; no extra + variant specifications or installed Hailo accelerator are assumed.

Validation:
- Production Astro build passes.
- Chrome: forward/reverse chapter navigation; all 14 stops present; no page JavaScript errors.
- 1440, 768 and 390 px: no document horizontal overflow; 390 px and reduced motion use the reading fallback.
- Updated fallback WebP/AVIF renders for all 11 robot features, including the folded hopper.
- Active-source Astro check: one pre-existing nullability error in src/scripts/studio-hook.ts:76; none in changed files. The default whole-workspace check additionally includes an untracked duplicate site and reports 20 errors total.
- Broad design inspector: 15 legacy style failures and 4 warnings across the existing FRC page (type, labels, headings, borders); not a clean whole-page design audit. Screenshots and temporary checks are in ignored .taste-skill/.
