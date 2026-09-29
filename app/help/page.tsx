import type { Metadata } from "next";
import Link from "next/link";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { DocPage, DocSection, Faq } from "../doc-page";
import { SERVICE_NAME } from "../site-footer";

export const metadata: Metadata = { title: `도움말 · ${SERVICE_NAME}` };

export default function HelpPage() {
  return (
    <DocPage
      title="도움말"
      intro={`${SERVICE_NAME}에서 투표하고 결과를 확인하는 방법을 안내합니다.`}
    >
      <DocSection title={`${SERVICE_NAME}는 어떤 서비스인가요?`}>
        <p>
          질문 하나에 선택지 여러 개가 있는 투표에서, 마음에 드는 선택지 <strong>하나</strong>를
          골라 표를 던지는 간단한 투표 서비스입니다. 가입이나 로그인 없이 바로 투표할 수 있습니다.
        </p>
      </DocSection>

      <DocSection title="투표하는 방법">
        <ol className="flex flex-col gap-1.5">
          <li>
            <Link href="/" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              투표 목록
            </Link>
            의 <strong>진행 중</strong> 구역에서 투표를 고릅니다. 공유받은 링크로 바로 들어가도 됩니다.
            목록에 나오지 않고 링크로만 들어오는 투표도 있습니다.
          </li>
          <li>
            선택지 중 하나를 고릅니다. <strong>참여 코드</strong>를 받은 투표라면 코드 입력칸에 받은 코드
            8자리를 넣습니다. <strong>복수 선택</strong> 투표는 안내된 최대 개수까지 여러 개를 고를 수
            있습니다. 코드가 담긴 개인 링크로 들어오면 이미 채워져 있고, 대소문자와 띄어쓰기는
            신경 쓰지 않아도 됩니다.
          </li>
          <li>
            <strong>투표하기</strong>를 누르면 끝입니다. 화면에 “투표 완료”와 내 선택이 표시됩니다.
          </li>
        </ol>
      </DocSection>

      <DocSection title="꼭 알아 두세요">
        <ul className="flex flex-col gap-1.5">
          <li>
            <strong>한 투표에 한 표</strong>만 던질 수 있고, 던진 표는 바꾸거나 취소할 수 없습니다.
          </li>
          <li>
            참여 코드를 쓰는 투표는 <strong>코드 하나로 한 번</strong> 투표합니다. 이미 쓴 코드나 틀린
            코드는 “사용할 수 없는 코드입니다”로 안내됩니다. 한 기기로 여러 사람이 투표할 때는 투표 완료
            화면의 <strong>다른 코드로 투표하기</strong>를 누르세요. 어떤 코드로 무엇을 골랐는지는 남지
            않습니다.
          </li>
          <li>
            모든 투표에는 <strong>마감 예정 시각</strong>이 있습니다. 목록과 투표 화면에서 “N시간 남음”으로
            남은 시간을 확인할 수 있고, 시각이 지나면 자동으로 마감됩니다.
          </li>
          <li>
            <strong>시작 예정</strong>인 투표는 질문과 선택지를 미리 볼 수 있지만, 시작 시각이 되어야
            투표할 수 있습니다.
          </li>
          <li>
            <strong>결과는 투표가 마감된 뒤에 공개</strong>됩니다. 복수 선택 투표의 결과는 “표 중 N%”로,
            전체 표 가운데 그 선택지를 고른 표의 비율입니다. 한 표에 여러 개를 고를 수 있어 비율을 더하면
            100%를 넘을 수 있습니다. 마감 전에는 선택지별 표 수와 전체 표 수가
            공개되지 않아, 다른 사람의 선택에 휩쓸리지 않고 투표할 수 있습니다.
          </li>
          <li>
            마감된 투표의 결과는 <strong>마감 후 {POLL_LIMITS.publicDays}일 동안</strong> 볼 수 있습니다. 그
            뒤에는 공개 기간이 끝나 목록과 링크에서 볼 수 없습니다.
          </li>
        </ul>
      </DocSection>

      <DocSection title="결과 보는 법">
        <p>
          투표 목록의 <strong>마감된 투표</strong>에서 투표를 누르면 결과가 나옵니다. 전체를 100%로 한 막대
          한 줄로 각 선택지가 차지한 몫을 보여 주고, 아래 목록에 선택지별 비율과 표 수를 표 수가 많은
          순서로 적습니다. 가장 많은 표를 받은 선택지에는 <strong>1위</strong>, 내가 고른 선택지에는{" "}
          <strong>내 선택</strong>이 표시됩니다.
        </p>
      </DocSection>

      <DocSection title="자주 묻는 질문">
        <div className="flex flex-col gap-2">
          <Faq question="잘못 골랐어요. 바꿀 수 있나요?">
            바꿀 수 없습니다. 한 번 던진 표는 그대로 집계됩니다. 투표하기 전에 선택지를 한 번 더
            확인해 주세요.
          </Faq>
          <Faq question="지금까지 몇 표가 나왔는지 볼 수 있나요?">
            마감 전에는 볼 수 없습니다. 마감되면 결과 화면에서 선택지별 표 수와 비율을 모두 볼 수 있습니다.
          </Faq>
          <Faq question="내가 무엇을 골랐는지 다시 볼 수 있나요?">
            투표한 브라우저로 다시 들어오면 “당신의 선택”이 표시됩니다. 브라우저의 쿠키를 지우면 이
            표시는 사라지지만, 이미 던진 표는 그대로 남습니다.
          </Faq>
          <Faq question="마감된 투표에 투표할 수 있나요?">
            할 수 없습니다. 마감된 투표는 표를 받지 않고, 다시 열리지 않습니다.
          </Faq>
          <Faq question="링크를 열었는데 “공개 기간이 끝난 투표입니다”라고 나와요.">
            마감 후 {POLL_LIMITS.publicDays}일이 지난 투표입니다. 공개 기간이 끝나 더 이상 결과를 볼 수
            없습니다.
          </Faq>
          <Faq question="“찾을 수 없음”이 나와요.">
            링크가 잘못되었거나 삭제된 투표입니다. 링크를 다시 확인해 주세요.
          </Faq>
        </div>
      </DocSection>
    </DocPage>
  );
}
