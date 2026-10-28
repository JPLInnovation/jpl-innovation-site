/**
 * FRC PAGE, "THE KITBOT PLATFORM IN 3D" (/work/frc/, right after the robot photo that opens to full screen).
 * The 3D robot turns to each part as its text comes up. Phones show each part's text as a card instead.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - The heading, the sentence under it, the small note and the screen reader description are shared with the
 *     rest of the FRC page's words: change them in src/text/projects/frc.ts (`frcPage.model3d`).
 *   - Keep the features in this order: each one has its camera position in src/lib/three/models/frc-robot-showcase.ts.
 *   - `id` is the part's link (/work/frc/#intake) and the name of its picture for phones,
 *     public/showcase/robot/<id>.webp (made by scripts/showcase-stills.py). Without a picture the card shows text only.
 *   - Only write what the CAD shows. The team hasn't confirmed speeds, weights or motor controller models yet.
 *   - The model is our modified robot (src/lib/three/models/frc-robot.ts), not the stock kit: the indexer and launcher
 *     each have a Kraken X60 outside the side plate, the two intake side fins are gone, and the hopper is extended.
 *   - The small label floating in the 3D view is the feature's `title`.
 */
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
			title: 'The KitBot platform',
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
			title: 'Hopper',
			text: 'We extended the kit’s hopper to hold more FUEL. It stays see-through polycarbonate, so the stored balls show; its floor slopes down to the indexer, which sends each one on to the launcher.',
			facts: [
				{ label: 'Walls', value: 'See-through polycarbonate' },
				{ label: 'Size', value: 'Extended from the kit' },
			],
		},
		{
			id: 'shooter',
			title: 'Indexer and launcher',
			text: 'The green indexer wheels push FUEL into the launcher wheel, which flings it up the curved hood and out of the top of the robot. Two Kraken X60 motors, mounted outside the side plate, drive the indexer and the launcher.',
			facts: [
				{ label: 'Order', value: 'Indexer, launcher wheel, hood' },
				{ label: 'Motors', value: 'Kraken X60, outside the frame' },
			],
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
