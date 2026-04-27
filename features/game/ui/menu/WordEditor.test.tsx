import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import WordEditor from "./WordEditor";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (key === "wordEditor.placeholder") return `WORD ${opts?.index}`;
			if (key === "wordEditor.start") return "START GAME";
			if (key === "wordEditor.generating") return "GENERATING...";
			return key;
		},
	}),
}));

describe("WordEditor Component", () => {
	const defaultWords = ["One", "Two", "Three", "Four"];

	let mockSetWords: Mock;
	let mockOnGenerate: Mock;

	beforeEach(() => {
		mockSetWords = vi.fn();
		mockOnGenerate = vi.fn();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should render 4 input fields with correctly passed words", () => {
		render(
			<WordEditor
				words={defaultWords}
				setWords={mockSetWords}
				onGenerate={mockOnGenerate}
			/>,
		);
		const inputs = screen.getAllByRole("textbox");
		expect(inputs).toHaveLength(4);
		expect(inputs[0]).toHaveValue("One");
		expect(inputs[3]).toHaveValue("Four");
	});

	it("should call setWords when an input changes", () => {
		const Wrapper = () => {
			const [words, setWords] = useState(["One", "Two", "Three", "Four"]);
			return (
				<WordEditor
					words={words}
					setWords={(newWords) => {
						setWords(newWords);
						mockSetWords(newWords);
					}}
					onGenerate={mockOnGenerate}
				/>
			);
		};

		render(<Wrapper />);

		const firstInput = screen.getAllByRole("textbox")[0];

		fireEvent.change(firstInput, { target: { value: "NewWord" } });

		expect(mockSetWords).toHaveBeenLastCalledWith([
			"NewWord",
			"Two",
			"Three",
			"Four",
		]);
	});

	it("should disable generate button if any word is empty", async () => {
		const user = userEvent.setup();
		const invalidWords = ["One", "", "Three", "Four"];
		render(
			<WordEditor
				words={invalidWords}
				setWords={mockSetWords}
				onGenerate={mockOnGenerate}
			/>,
		);

		const button = screen.getByRole("button");
		expect(button).toBeDisabled();

		await user.click(button);
		expect(mockOnGenerate).not.toHaveBeenCalled();
	});

	it("should show ETA countdown when isGeminiGenerating is true and disabled", () => {
		vi.useFakeTimers();

		render(
			<WordEditor
				words={defaultWords}
				setWords={mockSetWords}
				onGenerate={mockOnGenerate}
				disabled={true}
				isGeminiGenerating={true}
			/>,
		);

		expect(screen.getByText("GENERATING...")).toBeInTheDocument();
		expect(screen.getByText("7")).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(1100);
		});

		expect(screen.getByText("6")).toBeInTheDocument();

		vi.useRealTimers();
	});

	it("should call onGenerate when form is valid and button is clicked", async () => {
		const user = userEvent.setup();
		render(
			<WordEditor
				words={defaultWords}
				setWords={mockSetWords}
				onGenerate={mockOnGenerate}
			/>,
		);

		const button = screen.getByRole("button");
		expect(button).not.toBeDisabled();

		await user.click(button);
		expect(mockOnGenerate).toHaveBeenCalledOnce();
	});
});
