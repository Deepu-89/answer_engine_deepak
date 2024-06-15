"use client";
// 1. Import Dependencies
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
  use,
} from "react";
import { ArrowUp } from "lucide-react";
import { useActions, readStreamableValue } from "ai/rsc";
import { type AI } from "@/actions/index";
import { ChatScrollAnchor } from "@/lib/hooks/chat-scroll-anchor";
import Textarea from "react-textarea-autosize";
import { useEnterSubmit } from "@/lib/hooks/use-enter-submit";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
// Main components
import SearchResultsComponent from "@/components/SearchResultsComponent";
import UserMessageComponent from "@/components/UserMessageComponent";
import FollowUpComponent from "@/components/FollowUpComponent";
import InitialQueries from "@/components/InitialQueries";
import LLMResponseComponent from "@/components/LLMResponseComponent";
import ImagesComponent from "@/components/ImagesComponent";
import VideosComponent from "@/components/VideosComponent";

// 2. Set up types
interface SearchResult {
  favicon: string;
  link: string;
  title: string;
}
interface Message {
  id: number;
  type: string;
  content: string;
  userMessage: string;
  images: Image[];
  videos: Video[];
  followUp: FollowUp | null;
  isStreaming: boolean;
  searchResults?: SearchResult[];
}
interface StreamMessage {
  isolatedView: any;
  searchResults?: any;
  userMessage?: string;
  llmResponse?: string;
  llmResponseEnd?: boolean;
  images?: any;
  videos?: any;
  followUp?: any;
}
interface Image {
  link: string;
}
interface Video {
  link: string;
  imageUrl: string;
}
interface FollowUp {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export default function Home() {
  // 3. Set up action that will be used to stream all the messages
  const { myAction } = useActions<typeof AI>();
  console.log(myAction);

  // 4. Set up form submission handling
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  // 5. Set up state for the messages
  const [messages, setMessages] = useState<Message[]>([]);
  // 6. Set up state for the CURRENT LLM response (for displaying in the UI while streaming)
  const [currentLlmResponse, setCurrentLlmResponse] = useState("");
  //9a changed here from 9
  const handleUserMessageSubmission = async (
    userMessage: string
  ): Promise<void> => {
    const newMessageId = Date.now();
    const newMessage = {
      id: newMessageId,
      type: "userMessage",
      userMessage: userMessage,
      content: "",
      images: [],
      videos: [],
      followUp: null,
      isStreaming: true,
      searchResults: [] as SearchResult[],
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    let lastAppendedResponse = "";
    try {
      const streamableValue = await myAction(userMessage);

      let llmResponseString = "";
      for await (const message of readStreamableValue(streamableValue)) {
        const typedMessage = message as StreamMessage;
        setMessages((prevMessages) => {
          const messagesCopy = [...prevMessages];
          const messageIndex = messagesCopy.findIndex(
            (msg) => msg.id === newMessageId
          );
          if (messageIndex !== -1) {
            const currentMessage = messagesCopy[messageIndex];

            if (
              typedMessage.llmResponse &&
              typedMessage.llmResponse !== lastAppendedResponse
            ) {
              currentMessage.content += typedMessage.llmResponse;
              lastAppendedResponse = typedMessage.llmResponse;
            }

            if (typedMessage.llmResponseEnd) {
              currentMessage.isStreaming = false;
            }
            if (typedMessage.searchResults) {
              currentMessage.searchResults = typedMessage.searchResults;
            }
            if (typedMessage.images) {
              currentMessage.images = { ...typedMessage.images };
            }

            if (typedMessage.videos) {
              currentMessage.videos = { ...typedMessage.videos };
            }
            if (typedMessage.followUp) {
              currentMessage.followUp = typedMessage.followUp;
            }
          }
          return messagesCopy;
        });

        if (typedMessage.llmResponse) {
          llmResponseString += typedMessage.llmResponse;
          setCurrentLlmResponse(llmResponseString);
        }
      }
    } catch (error) {
      console.error("Error streaming data for user message:", error);
    }
  };
  // 7. Set up handler for when the user clicks on the follow up button
  const handleFollowUpClick = useCallback(async (question: string) => {
    setCurrentLlmResponse("");
    await handleUserMessageSubmission(question);
  }, []);

  // 8. For the form submission, we need to set up a handler that will be called when the user submits the form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        if (
          e.target &&
          ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).nodeName)
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (inputRef?.current) {
          inputRef.current.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef]);

  // 9. Set up handler for when a submission is made, which will call the myAction function
  const handleSubmit = async (message: string) => {
    if (!message) return;
    await handleUserMessageSubmission(message);
  };
  const handleFormSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    const messageSend = inputValue.trim();
    if (!messageSend) return;
    setInputValue("");

    await handleSubmit(messageSend);
  };

  return (
    <div>
      {messages.length > 0 && (
        <div className="flex flex-col">
          {messages.map((message, index) => (
            <div key={`message-${index}`} className="flex flex-col md:flex-row">
              <div className="w-full md:w-3/4 md:pr-2">
                {message.searchResults && (
                  <SearchResultsComponent
                    key={`searchResults-${index}`}
                    searchResults={message.searchResults}
                  />
                )}
                {message.type === "userMessage" && (
                  <UserMessageComponent message={message.userMessage} />
                )}
                <LLMResponseComponent
                  llmResponse={message.content}
                  currentLlmResponse={currentLlmResponse}
                  index={index}
                  key={`llm-response-${index}`}
                />
                {message.followUp && (
                  <div className="flex flex-col">
                    <FollowUpComponent
                      key={`followUp-${index}`}
                      followUp={message.followUp}
                      handleFollowUpClick={handleFollowUpClick}
                    />
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/4 md:pl-2">
                {message.videos && (
                  <VideosComponent
                    key={`videos-${index}`}
                    videos={message.videos}
                  />
                )}
                {message.images && (
                  <ImagesComponent
                    key={`images-${index}`}
                    images={message.images}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pb-[80px] pt-4 md:pd-10">
        <ChatScrollAnchor trackVisibility={true} />
      </div>
      <div
        className={`px-2 fixed inset-x-0 bottom-0 w-full bg-gradient-to-b duration-300 ease-in-out animate-in dark:from-gray-900/10 dark:from-10% peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]] mb-4 bring-to-front`}
      >
        <div className="mx-auto max-w-xl sm:px-4 ">
          <div className="px-4 py-4  space-y-4 border-t shadow-lg bg-background  rounded-full  sm: border-4 md:py-4">
            {messages.length === 0 && !inputValue && (
              <InitialQueries
                questions={[
                  "When did Daft Punk release Da Funk?",
                  "How is Apple's stock doing these days?",
                  "Where can I get the best bagel in NYC?",
                  "I want to buy a mens patagonia vest",
                ]}
                handleFollowUpClick={handleFollowUpClick}
              />
            )}
            <form
              ref={formRef}
              onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                handleFormSubmit(e);
                setCurrentLlmResponse("");
                if (window.innerWidth < 600) {
                  (e.target as HTMLFormElement)["message"]?.blur();
                }
                const value = inputValue.trim();
                setInputValue("");
                if (!value) return;
              }}
            >
              <div className="relative flex flex-col w-full overflow-hidden max-h-60 grow dark:bg-slate-800 bg-gray-100 border sm:px-2">
                <Textarea
                  ref={inputRef}
                  tabIndex={0}
                  onKeyDown={onKeyDown}
                  placeholder="Send a message."
                  className={`w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm dark:text-white text-black pr-[45px] `}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  name="message"
                  rows={1}
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    const value = e.target.value;
                    setInputValue(value);
                  }}
                />
                <div className="absolute right-5 top-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="submit"
                        size="icon"
                        disabled={inputValue === ""}
                      >
                        <ArrowUp />
                        <span className="sr-only">Send message</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send message</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="pb-[80px] pt-4 md:pt-10"></div>
    </div>
  );
}
