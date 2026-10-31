/** Feature copy for the shared 10951_robot.glb CAD model. Stop IDs also identify fallback renders. */
import { frcPage } from "../projects/frc";

export const robotShowcase = {
	heading: frcPage.model3d.heading,
	intro: frcPage.model3d.text,
	note: frcPage.model3d.note,
	/** Read aloud by screen readers instead of the 3D view. */
	modelLabel: frcPage.model3d.description,
	/** Read aloud by screen readers for the row of dots that jump to each part. */
	dotsLabel: 'Parts of the robot',
	features: [
		{
			id: 'overview',
			title: 'Follow the FUEL',
			text: 'Our 2026 robot, built on the KitBot platform and modified by the team. It rolls on six wheels, with blue bumpers carrying our team number, 10951.',
			facts: [
				{ label: 'Robot', value: 'A modified KitBot' },
				{ label: 'Base', value: 'The kit’s platform' },
				{ label: 'Wheels', value: 'Six' },
				{ label: 'Bumpers', value: 'Blue, team 10951' },
			],
		},
		{
			id: 'intake',
			title: 'Intake',
			text: 'Blue and orange flex stars pull FUEL, the 150 mm foam ball, off the floor and up the intake ramp into the hopper. We removed the kit’s two side fins to feed more reliably.',
			facts: [
				{ label: 'Rollers', value: 'Flex star wheels' },
				{ label: 'Game piece', value: 'FUEL, a 150 mm foam ball' },
				{ label: 'Path', value: 'Floor, up the ramp, into the hopper' },
			],
		},
		{
			id: 'hopper',
			title: 'Wider hopper',
			text: 'The widened hopper uses the space inside the robot frame. Transparent polycarbonate walls hold the FUEL, while the sloped floor guides it toward the indexer.',
			facts: [{ label: 'Position', value: 'Inside the robot frame' }, { label: 'Panels', value: 'Transparent polycarbonate' }],
		},
		{
            id: 'indexer', title: 'Indexer',
            text: 'The green indexer wheels move FUEL from the hopper into the shooter. A separate REV NEO drive lets the indexer meter the feed independently of the flywheel. Follow the yellow ball through the handoff.',
            facts: [{ label: 'Mechanism', value: 'Green indexer wheels' }, { label: 'Motor in this CAD', value: 'REV NEO V1.1' }, { label: 'Job', value: 'Feed the flywheel' }],
        },
        {
            id: 'shooter',
			title: 'Flywheel & shooter',
			text: 'The indexer delivers FUEL to the spinning flywheel. The wheel accelerates it against the curved hood, which guides the ball up and out. The upper Kraken drives the flywheel through an HTD5 belt.',
			facts: [
				{ label: 'Order', value: 'Indexer, launcher wheel, hood' },
				{ label: 'Drive', value: 'Kraken X60 + HTD5 belt' },
			],
		},
        {
            id: 'hopper-close', title: 'Extended hopper',
            text: 'The extension adds storage beyond the robot footprint. These outer side and rear panels are separate from the wider hopper inside the frame.',
            facts: [{ label: 'Position', value: 'Beyond the robot footprint' }, { label: 'Panels', value: 'Transparent polycarbonate' }],
        },
        {
            id: 'krakens', title: 'Kraken X60',
            text: 'Two Kraken X60 motors drive the intake and flywheel through separate belt paths. Each motor combines a brushless motor, a Talon FX controller and an encoder in one package. Feedback lets robot code regulate mechanism speed as the load changes.',
            facts: [{ label: 'Motor', value: 'WCP Kraken X60' }, { label: 'Controller', value: 'Integrated CTRE Talon FX' }, { label: 'Feedback', value: 'Built-in encoder' }],
        },
        {
            id: 'vision', title: 'Limelight 4+',
            text: 'Our Limelight 4+ processes camera images on board. AprilTags provide known landmarks for estimating robot position. With MegaTag2, robot heading, the camera mount transform and a field map work together to produce a pose estimate.',
            facts: [{ label: 'Vision', value: 'Limelight 4+' }, { label: 'Landmarks', value: 'AprilTags' }, { label: 'MegaTag2 needs', value: 'Robot heading + calibrated camera pose' }],
        },
        {
            id: 'odometry', title: 'Pigeon 2.0 & odometry',
            text: 'The CTRE Pigeon 2.0 measures orientation. Its heading combines with left and right wheel encoder distances to estimate this six-wheel robot?s position. Limelight measurements can correct accumulated drift when fused into a pose estimator.',
            facts: [{ label: 'Heading', value: 'CTRE Pigeon 2.0' }, { label: 'Distance', value: 'Wheel encoders' }, { label: 'Correction', value: 'Vision pose measurements' }],
        },
        {
            id: 'drivetrain',
			title: 'Drivetrain',
			text: 'Six wheels on an aluminium frame. CIM motors drive them through belts and gears.',
			facts: [
				{ label: 'Wheels', value: 'Six' },
				{ label: 'Motors', value: 'CIM' },
				{ label: 'Drive', value: 'Belts and gears' },
				{ label: 'Frame', value: 'Aluminium' },
			],
		},
		{
			id: 'electronics',
			title: 'Battery and electronics',
			text: 'The battery sits low at the back, near the power hub that feeds the rest of the robot. The orange signal light is up on top.',
			facts: [
				{ label: 'Battery', value: 'Low at the back' },
				{ label: 'Power', value: 'Power hub' },
				{ label: 'Signal light', value: 'Orange, on top' },
			],
		},
	],
};
