import DefaultButton from '@root/src/components/button/DefaultButton';
import PrimaryButton from '@root/src/components/button/PrimaryButton';
import Text from '@root/src/components/Text';

const OtherResources = () => (
  <div className="flex w-full flex-col gap-3 border-0 border-t border-grayBackground p-large text-center">
    <Text type="subtitle">Other resources</Text>
    <PrimaryButton href="https://app.monarchmoney.com/signup">Sign up for Monarch</PrimaryButton>
    <DefaultButton href="https://www.monarchmoney.com/compare/mint-alternative">
      Import data into Monarch
    </DefaultButton>
  </div>
);

export default OtherResources;
