# Exact 10951 robot rendering ? 2026-10-31

The active renderer now preserves all source triangles, vertex normals, source material values and node transforms from `CAD/10951_robot.glb`. The hopper stays in its exported pose. No decimation, outline reconstruction, dropped hardware or invented hinge rotation is used.

- Source SHA-256: `88c39211e8d51897d638aab801742fee119a62844a684f33a9cdef6c1e788bae`.
- 851 mesh instances; 13,538,800 rendered triangles; 424 shared geometry/material batches.
- `python scripts/robot-exact.py` rebuilds `public/assets/robot/` with NumPy. Gzip is lossless; the approximately 47 MB payload is only requested by the optional 3D inspector. Workers decompress geometry and transfer buffers to the main thread.
- `python scripts/render-robot-exact.py` exports all 14 chapter views at **3840 ? 2160** plus responsive 1600/800 px WebP and AVIF versions. Run a production build and local preview first. Requires Python Playwright, Chrome, and the project's Sharp dependency.
- The normal chapter crossfades these exact-model renders with native scroll. No model download or WebGL animation occurs during normal scrolling. Inspect in 3D is explicit; further scrolling closes the inspector and restores images. Mobile and reduced motion keep the reading layout with updated renders.
- The Kraken, NEO/indexer, Limelight and Pigeon stops isolate hardware so panels cannot hide it. The GLB's unnamed `mesh0` Pigeon housing and `Minimal` camera assembly are associated by their measured bounds. Their geometry is unchanged.
- The full robot and hopper renders show the original assembly. FUEL balls are illustrative overlays, not part of the source GLB.

Validation: production build; Chrome desktop scroll, optional inspector entry/exit, mobile layout, all 14 images loaded; no page JS errors. Normal scrolling requested zero robot model payloads. On this workstation, the desktop sweep measured 4.2 ms median / 4.3 ms p95 frame intervals, with one 104 ms worst interval. This is a local measurement, not a universal zero-lag guarantee. The previous continuous full-model capture measured about 82 ms/frame. Full-workspace Astro checking includes unrelated errors in the untracked duplicate site and an existing nullability error in `src/scripts/studio-hook.ts:76`.

## Earlier implementation (superseded geometry and hopper animation)

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
