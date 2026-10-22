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
			text: 'The standard KitBot platform our 2026 robot is built on. It rolls on six wheels, with blue bumpers carrying our team number, 10951.',
			facts: [
				{ label: 'Robot', value: 'KitBot platform' },
				{ label: 'Model', value: 'The kit’s standard design' },
				{ label: 'Wheels', value: 'Six' },
				{ label: 'Bumpers', value: 'Blue, team 10951' },
			],
		},
		{
			id: 'intake',
			title: 'Intake',
			text: 'Two intake rollers with yellow spacers pull FUEL, the 150 mm foam ball, off the floor and up the intake ramp into the hopper.',
			facts: [
				{ label: 'Rollers', value: 'Two, with yellow spacers' },
				{ label: 'Game piece', value: 'FUEL, a 150 mm foam ball' },
				{ label: 'Path', value: 'Floor, up the ramp, into the hopper' },
			],
		},
		{
			id: 'hopper',
			title: 'Hopper',
			text: 'The hopper is see-through polycarbonate, so the stored FUEL shows. Its floor slopes down to the feeder roller, which sends each ball on to the launcher.',
			facts: [
				{ label: 'Walls', value: 'See-through polycarbonate' },
				{ label: 'Floor', value: 'Slopes down to the feeder' },
			],
		},
		{
			id: 'shooter',
			title: 'Feeder and launcher',
			text: 'The feeder roller pushes FUEL into the launcher wheel, which flings it up the curved hood and out of the top of the robot.',
			facts: [
				{ label: 'Order', value: 'Feeder, launcher wheel, hood' },
				{ label: 'Shoots', value: 'Up and out of the top' },
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
